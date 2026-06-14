import test from "node:test";
import assert from "node:assert/strict";
import { fakeOrderHistory } from "../src/data/c2cCommerce.js";
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
    order: fakeOrderHistory[0],
    sellerCondition: { preset: "pristine" },
  });

  assert.equal(listing.publishable, false);
  assert.equal(listing.status, "blocked_identity_mismatch");
  assert.equal(listing.grade.grade, "Mismatch");
  assert.equal(listing.price, 0);
});
