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
    "earphones",
    "headphone",
    "headphones",
    "headset",
    "microphone",
  ],
  camera: ["camera", "lens", "photography"],
  laptop: ["keyboard", "laptop", "macbook", "notebook"],
  phone: ["cell phone", "iphone", "mobile phone", "phone", "smartphone"],
  tablet: ["ipad", "tablet"],
  wearable: ["smartwatch", "watch", "wearable", "wristwatch"],
};
const weakIdentityTerms = new Set([
  "accessory",
  "black",
  "computer",
  "consumer",
  "device",
  "electronic",
  "electronics",
  "gadget",
  "gray",
  "grey",
  "hand",
  "hardware",
  "mobile",
  "object",
  "portable",
  "product",
  "screen",
  "silver",
  "technology",
  "white",
  "wireless",
]);

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

function textContainsTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function uniqueTermsFromText(text = "") {
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .map((term) => term.trim())
        .filter((term) => term.length >= 3 && !weakIdentityTerms.has(term)),
    ),
  ];
}

function expectedProductTerms(returnCase) {
  const category = returnCase.item.category;
  const categorySpecific = categoryTerms[category] ?? [category];
  const metadataTerms = uniqueTermsFromText(
    [
      returnCase.item.title,
      returnCase.item.brandLine,
      returnCase.item.variant,
      returnCase.item.sku,
    ].join(" "),
  );

  return [
    ...new Set(
      [...categorySpecific, ...metadataTerms]
        .map((term) => term.toLowerCase().trim())
        .filter((term) => term.length >= 3 && !weakIdentityTerms.has(term)),
    ),
  ];
}

function isRelevantLabel(label, category) {
  const expectedTerms = categoryTerms[category] ?? [category];
  const text = labelText(label);
  return expectedTerms.some((term) => textContainsTerm(text, term));
}

export function compareLabelsToExpectedItem(labels, returnCase) {
  const expectedTerms = expectedProductTerms(returnCase);
  const detectedText = labels.map((label) => labelText(label)).join(" | ");
  const relevant = labels.filter((label) => isRelevantLabel(label, returnCase.item.category));
  const matchedTerms = expectedTerms.filter((term) => textContainsTerm(detectedText, term));
  const strongMatchCount = matchedTerms.filter((term) => !weakIdentityTerms.has(term)).length;
  const matchScore = Math.min(100, relevant.length * 35 + strongMatchCount * 18);
  const identityStatus =
    relevant.length > 0 || matchScore >= 45
      ? "matched"
      : labels.length
        ? "mismatch"
        : "unknown";

  return {
    expectedTerms,
    matchedTerms,
    matchScore,
    relevant,
    ignored: labels.filter((label) => !relevant.includes(label)),
    identityStatus,
    method: "rekognition-labels-vs-order-metadata",
  };
}

function splitLabelsByExpectedItem(labels, returnCase) {
  const comparison = compareLabelsToExpectedItem(labels, returnCase);
  const relevant = labels.filter((label) => isRelevantLabel(label, returnCase.item.category));
  const ignored = labels.filter((label) => !isRelevantLabel(label, returnCase.item.category));

  return {
    relevant,
    ignored,
    identityStatus: comparison.identityStatus,
    comparison,
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

function topConfidence(labels) {
  return labels.reduce(
    (highest, label) => Math.max(highest, Number(label.confidence ?? label.Confidence ?? 0)),
    0,
  );
}

async function detectLabelsFromBytes(bytes) {
  const response = await getRekognitionClient().send(
    new DetectLabelsCommand({
      Image: {
        Bytes: bytes,
      },
      MaxLabels: 20,
      MinConfidence: 50,
    }),
  );

  return (
    response.Labels?.map((label) => ({
      name: label.Name,
      confidence: Number((label.Confidence ?? 0).toFixed(1)),
      parents: label.Parents?.map((parent) => parent.Name).filter(Boolean) ?? [],
    })) ?? []
  );
}

async function detectReferenceImageLabels(returnCase) {
  const imageUrl = returnCase.item.image;
  if (!imageUrl?.startsWith("http")) {
    return {
      compared: false,
      reason: "Reference image is local to the frontend build.",
    };
  }

  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      throw new Error(`Reference image returned ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Reference image is empty or too large for comparison.");
    }

    return {
      compared: true,
      labels: await detectLabelsFromBytes(bytes),
      imageUrl,
    };
  } catch (error) {
    return {
      compared: false,
      imageUrl,
      reason: error.message,
    };
  }
}

function labelTermSet(labels) {
  return new Set(
    labels.flatMap((label) => uniqueTermsFromText(labelText(label))),
  );
}

function compareUploadedToReference({ uploadedLabels, referenceLabels = [] }) {
  if (!referenceLabels.length) {
    return {
      compared: false,
      similarity: 0,
      overlappingTerms: [],
    };
  }

  const uploadedTerms = labelTermSet(uploadedLabels);
  const referenceTerms = labelTermSet(referenceLabels);
  const overlappingTerms = [...referenceTerms].filter((term) => uploadedTerms.has(term));
  const denominator = Math.max(1, Math.min(referenceTerms.size, uploadedTerms.size));

  return {
    compared: true,
    similarity: Math.round((overlappingTerms.length / denominator) * 100),
    overlappingTerms,
  };
}

function summarizeRelevantLabels({ relevant, ignored, identityStatus, returnCase }) {
  if (identityStatus === "mismatch") {
    return `Uploaded photo does not match the selected order proof for ${returnCase.item.title}. Choose the matching order or upload the correct product photo.`;
  }

  const topLabels = formatLabels(relevant);
  if (!topLabels.length) {
    return "AWS Rekognition did not return confident labels for this image.";
  }

  return `Uploaded photo matches the selected order category. NexTurn still grades condition from visual similarity and damage-risk signals before pricing.`;
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
    const rawLabels = await detectLabelsFromBytes(decoded.bytes);
    const reference = await detectReferenceImageLabels(returnCase);
    const referenceComparison = compareUploadedToReference({
      uploadedLabels: rawLabels,
      referenceLabels: reference.labels,
    });
    const { relevant, ignored, identityStatus, comparison } = splitLabelsByExpectedItem(
      rawLabels,
      returnCase,
    );
    const topRelevantConfidence = topConfidence(relevant);
    const topIgnoredConfidence = topConfidence(ignored);
    const dominantUnrelatedEvidence =
      topIgnoredConfidence >= 80 && topIgnoredConfidence - topRelevantConfidence >= 18;
    const weakProductEvidence =
      identityStatus === "matched" && topRelevantConfidence > 0 && topRelevantConfidence < 72;
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
        identityComparison: {
          ...comparison,
          topRelevantConfidence,
          topIgnoredConfidence,
          dominantUnrelatedEvidence,
          weakProductEvidence,
          method: referenceComparison.compared
            ? "rekognition-upload-vs-order-photo-and-metadata"
            : comparison.method,
          referenceImageCompared: referenceComparison.compared,
          referenceImageUrl: reference.imageUrl,
          referenceImageReason: reference.reason,
          referenceSimilarity: referenceComparison.similarity,
          referenceOverlappingTerms: referenceComparison.overlappingTerms,
          referenceLabels: reference.labels ?? [],
        },
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
