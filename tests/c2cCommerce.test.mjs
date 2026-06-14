import test from "node:test";
import assert from "node:assert/strict";
import { orderProofHistory } from "../src/data/c2cCommerce.js";
import { createListingFromEvaluation, mergeMarketplaceListings } from "../src/lib/c2cCommerce.js";

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

test("normalizes legacy persisted listings into INR marketplace data", () => {
  const marketplace = mergeMarketplaceListings(
    [
      {
        id: "legacy_airpods_listing",
        status: "active",
        createdAt: "2026-06-14T10:00:00.000Z",
        sellerId: "legacy_seller",
        item: {
          ...orderProofHistory[0],
          originalPrice: 549,
        },
        grade: {
          grade: "A",
          label: "Like new",
        },
        price: 405.99,
        discountPercent: 26,
      },
    ],
    [],
  );

  const listing = marketplace.heroListings.find((item) => item.id === "legacy_airpods_listing");

  assert.ok(listing.price > 40000);
  assert.equal(listing.item.originalPrice, orderProofHistory[0].originalPrice);
  assert.equal(listing.category, "Electronics");
  assert.ok(listing.sellerCity);
  assert.ok(listing.deliveryFee >= 79);
});
