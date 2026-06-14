import test from "node:test";
import assert from "node:assert/strict";
import { orderProofHistory } from "../src/data/c2cCommerce.js";
import { createListingFromEvaluation } from "../src/lib/c2cCommerce.js";

test("blocks marketplace publishing when uploaded photo mismatches selected order", () => {
  const listing = createListingFromEvaluation({
    aiAnalysis: {
      provider: "aws-rekognition",
      mode: "live",
      usedAws: true,
      identityStatus: "mismatch",
      labels: [],
      rawLabels: [{ name: "Mobile Phone", confidence: 99 }],
      summary: "Uploaded photo does not match the selected Amazon order item.",
    },
    identity: {
      customerId: "cognito#seller",
      name: "Seller",
      email: "seller@example.com",
    },
    media: { persisted: true, mode: "s3" },
    order: orderProofHistory[0],
    uploadContext: {},
  });

  assert.equal(listing.publishable, false);
  assert.equal(listing.status, "blocked_identity_mismatch");
  assert.equal(listing.grade.grade, "Mismatch");
  assert.equal(listing.price, 0);
});

test("downgrades weak visual matches even when the broad product category matches", () => {
  const listing = createListingFromEvaluation({
    aiAnalysis: {
      provider: "aws-rekognition",
      mode: "live",
      usedAws: true,
      identityStatus: "matched",
      labels: [{ name: "Headphones", confidence: 55 }],
      ignoredLabels: [{ name: "Home Decor", confidence: 96 }],
      rawLabels: [
        { name: "Headphones", confidence: 55 },
        { name: "Home Decor", confidence: 96 },
      ],
      identityComparison: {
        topRelevantConfidence: 55,
        topIgnoredConfidence: 96,
        dominantUnrelatedEvidence: true,
        referenceImageCompared: true,
        referenceSimilarity: 20,
      },
    },
    identity: {
      customerId: "cognito#seller",
      name: "Seller",
      email: "seller@example.com",
    },
    media: { persisted: true, mode: "s3" },
    order: orderProofHistory[0],
    uploadContext: {},
  });

  assert.equal(listing.publishable, true);
  assert.equal(listing.grade.grade, "C");
  assert.ok(listing.scorecard.damageFlags.includes("visual_condition_risk"));
});
