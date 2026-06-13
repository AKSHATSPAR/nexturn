import { DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const mediaBucketName = process.env.NEX_TURN_MEDIA_BUCKET_NAME;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const parents = label.Parents?.map((parent) => parent.Name).filter(Boolean) ?? [];
  return [label.Name, ...parents].join(" ").toLowerCase();
}

function buildSignals(labels) {
  const labelNames = labels.map((label) => labelText(label));
  const hasAudioProduct = labelNames.some((label) =>
    ["headphone", "headphones", "headset", "electronics", "audio"].some((term) =>
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
  if (hasAudioProduct) {
    signals.push("AWS Rekognition detected an audio/electronics product in the upload");
  }
  if (hasAccessory) {
    signals.push("AWS Rekognition detected accessory-like objects in the upload");
  }
  if (hasPackageOrTable) {
    signals.push("AWS Rekognition detected packaging or inspection surface context");
  }
  if (!signals.length && labels.length) {
    signals.push("AWS Rekognition returned image labels for human inspection review");
  }

  return signals;
}

function summarizeLabels(labels) {
  const topLabels = labels
    .slice(0, 5)
    .map((label) => `${label.Name} ${Math.round(label.Confidence ?? 0)}%`);

  if (!topLabels.length) {
    return "AWS Rekognition did not return confident labels for this image.";
  }

  return `AWS Rekognition labels: ${topLabels.join(", ")}.`;
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

    const labels =
      response.Labels?.map((label) => ({
        name: label.Name,
        confidence: Number((label.Confidence ?? 0).toFixed(1)),
        parents: label.Parents?.map((parent) => parent.Name).filter(Boolean) ?? [],
      })) ?? [];
    const inspectionSignals = buildSignals(response.Labels ?? []);

    return {
      aiAnalysis: {
        provider: "aws-rekognition",
        mode: "live",
        usedAws: true,
        confidence: labels.length ? "AWS image labels available" : "Low visual confidence",
        labels,
        inspectionSignals,
        summary: summarizeLabels(response.Labels ?? []),
        limitation:
          "Rekognition identifies objects and scene signals; final grade remains an explainable customer policy decision.",
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
