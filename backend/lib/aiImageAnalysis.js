import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const mediaBucketName = process.env.NEX_TURN_MEDIA_BUCKET_NAME;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const categoryTerms = {
  audio: [
    "audio",
    "airpods",
    "earbud",
    "earbuds",
    "earphone",
    "electronics",
    "headphone",
    "headphones",
    "headset",
    "microphone",
  ],
  camera: ["camera", "electronics", "lens", "photography"],
  laptop: ["computer", "electronics", "keyboard", "laptop", "macbook", "notebook", "pc"],
  phone: ["cell phone", "electronics", "iphone", "mobile phone", "phone", "smartphone"],
  tablet: ["computer", "electronics", "ipad", "screen", "tablet"],
  wearable: ["electronics", "smartwatch", "watch", "wearable", "wristwatch"],
};

let rekognitionClient;
let s3Client;

function getRekognitionClient() {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({});
  }
  return rekognitionClient;
}

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
}

function stripDataUrl(value = "") {
  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    return {
      mimeType: undefined,
      payload: value,
    };
  }

  return {
    mimeType: match[1],
    payload: match[2],
  };
}

function sanitizeFileName(fileName = "scan-upload") {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "scan-upload";
}

export function decodeImagePayload({ imageBase64, mimeType }) {
  if (!imageBase64) return null;

  const stripped = stripDataUrl(imageBase64);
  const buffer = Buffer.from(stripped.payload, "base64");

  if (!buffer.length) {
    throw new Error("Uploaded image is empty.");
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is larger than the 5 MB prototype limit.");
  }

  return {
    bytes: buffer,
    mimeType: mimeType ?? stripped.mimeType ?? "image/jpeg",
  };
}

async function persistUpload({ returnCase, bytes, mimeType, fileName }) {
  if (!mediaBucketName) {
    return {
      persisted: false,
      mode: "no-bucket",
      message: "Media bucket is not configured in this environment.",
    };
  }

  const now = new Date();
  const safeName = sanitizeFileName(fileName);
  const objectKey = [
    "returns",
    returnCase.customer.id,
    returnCase.id,
    `${now.toISOString().replace(/[:.]/g, "-")}-${safeName}`,
  ].join("/");

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: mediaBucketName,
      Key: objectKey,
      Body: bytes,
      ContentType: mimeType,
      Metadata: {
        returnId: returnCase.id,
        customerId: returnCase.customer.id,
        source: "nexturn-upload",
      },
    }),
  );

  return {
    persisted: true,
    mode: "s3",
    bucketName: mediaBucketName,
    objectKey,
  };
}

function labelText(label) {
  const parents =
    label.parents ?? label.Parents?.map((parent) => parent.Name).filter(Boolean) ?? [];
  return [label.name ?? label.Name, ...parents].join(" ").toLowerCase();
}

function isRelevantLabel(label, category) {
  const expectedTerms = categoryTerms[category] ?? [category];
  const text = labelText(label);
  return expectedTerms.some((term) => text.includes(term));
}

function splitLabelsByExpectedItem(labels, returnCase) {
  const relevant = labels.filter((label) => isRelevantLabel(label, returnCase.item.category));
  const ignored = labels.filter((label) => !isRelevantLabel(label, returnCase.item.category));
  const identityStatus = relevant.length ? "matched" : labels.length ? "mismatch" : "unknown";

  return {
    relevant,
    ignored,
    identityStatus,
  };
}

function buildSignals(labels, returnCase) {
  const labelNames = labels.map((label) => labelText(label));
  const expectedTerms = categoryTerms[returnCase.item.category] ?? [returnCase.item.category];
  const hasExpectedProduct = labelNames.some((label) =>
    expectedTerms.some((term) =>
      label.includes(term),
    ),
  );
  const hasAccessory = labelNames.some((label) =>
    ["cable", "case", "bag", "accessory", "charger"].some((term) => label.includes(term)),
  );
  const hasPackageOrTable = labelNames.some((label) =>
    ["box", "package", "desk", "table"].some((term) => label.includes(term)),
  );

  const signals = [];
  if (hasExpectedProduct) {
    signals.push(
      `Visual identity check matched the expected ${returnCase.item.category} item`,
    );
  }
  if (hasAccessory) {
    signals.push("Visual evidence includes accessory-like objects");
  }
  if (hasPackageOrTable) {
    signals.push("Visual evidence includes packaging or inspection surface context");
  }
  if (!signals.length && labels.length) {
    signals.push(
      `Visual upload does not confidently match expected ${returnCase.item.category} item; manual review required`,
    );
  }

  return signals;
}

function formatLabels(labels) {
  return labels
    .slice(0, 5)
    .map((label) => `${label.name ?? label.Name} ${Math.round(label.confidence ?? label.Confidence ?? 0)}%`);
}

function summarizeRelevantLabels({ relevant, ignored, identityStatus, returnCase }) {
  if (identityStatus === "mismatch") {
    const rawLabels = formatLabels(ignored);
    return `Visual identity check did not match the expected ${returnCase.item.category} return. Manual review required${
      rawLabels.length ? `; unrelated labels seen: ${rawLabels.join(", ")}.` : "."
    }`;
  }

  const topLabels = formatLabels(relevant);
  if (!topLabels.length) {
    return "AWS Rekognition did not return confident labels for this image.";
  }

  const ignoredLabels = formatLabels(ignored);
  return `Visual identity check matched expected ${returnCase.item.category} evidence: ${topLabels.join(", ")}.${
    ignoredLabels.length ? ` Ignored unrelated labels: ${ignoredLabels.join(", ")}.` : ""
  }`;
}

export async function analyzeReturnImage({ returnCase, imageBase64, mimeType, fileName }) {
  const decoded = decodeImagePayload({ imageBase64, mimeType });

  if (!decoded) {
    return {
      aiAnalysis: {
        provider: "rules-engine",
        mode: "no-upload",
        usedAws: false,
        confidence: "Not run",
        labels: [],
        inspectionSignals: [],
        summary: "No image was uploaded; condition grade used the existing scan signals.",
      },
      media: {
        persisted: false,
        mode: "no-upload",
      },
    };
  }

  let media;
  try {
    media = await persistUpload({
      returnCase,
      bytes: decoded.bytes,
      mimeType: decoded.mimeType,
      fileName,
    });
  } catch (error) {
    media = {
      persisted: false,
      mode: "s3-error",
      message: error.message,
    };
  }

  try {
    const response = await getRekognitionClient().send(
      new DetectLabelsCommand({
        Image: {
          Bytes: decoded.bytes,
        },
        MaxLabels: 15,
        MinConfidence: 50,
      }),
    );

    const rawLabels =
      response.Labels?.map((label) => ({
        name: label.Name,
        confidence: Number((label.Confidence ?? 0).toFixed(1)),
        parents: label.Parents?.map((parent) => parent.Name).filter(Boolean) ?? [],
      })) ?? [];
    const { relevant, ignored, identityStatus } = splitLabelsByExpectedItem(
      rawLabels,
      returnCase,
    );
    const inspectionSignals = buildSignals(relevant.length ? relevant : rawLabels, returnCase);

    return {
      aiAnalysis: {
        provider: "aws-rekognition",
        mode: "live",
        usedAws: true,
        confidence:
          identityStatus === "matched"
            ? "Expected product visually matched"
            : "Needs manual identity review",
        identityStatus,
        labels: relevant,
        ignoredLabels: ignored,
        rawLabels,
        inspectionSignals,
        summary: summarizeRelevantLabels({
          relevant,
          ignored,
          identityStatus,
          returnCase,
        }),
        limitation:
          "Rekognition checks visual identity evidence. The final A/B/C grade comes from functional, cosmetic, accessory, hygiene, packaging, fraud-risk, and demand signals.",
      },
      media,
    };
  } catch (error) {
    return {
      aiAnalysis: {
        provider: "aws-rekognition",
        mode: "fallback",
        usedAws: false,
        confidence: "AWS AI unavailable",
        labels: [],
        inspectionSignals: [],
        errorCode: error.name,
        summary:
          "AWS Rekognition could not analyze this upload, so NexTurn kept the deterministic scan result and surfaced the issue transparently.",
        limitation: error.message,
      },
      media,
    };
  }
}
