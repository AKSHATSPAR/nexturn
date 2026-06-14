import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeReturnImage,
  compareLabelsToExpectedItem,
  decodeImagePayload,
} from "../backend/lib/aiImageAnalysis.js";
import { returnCase } from "../src/data/returnCase.js";
import { orderProofHistory } from "../src/data/c2cCommerce.js";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

test("decodes browser data-url uploads for AWS image analysis", () => {
  const decoded = decodeImagePayload({
    imageBase64: tinyPng,
  });

  assert.equal(decoded.mimeType, "image/png");
  assert.ok(decoded.bytes.byteLength > 0);
});

test("returns transparent no-upload mode without calling AWS", async () => {
  const result = await analyzeReturnImage({
    returnCase,
  });

  assert.equal(result.aiAnalysis.provider, "rules-engine");
  assert.equal(result.aiAnalysis.mode, "no-upload");
  assert.equal(result.aiAnalysis.usedAws, false);
  assert.equal(result.media.persisted, false);
});

test("does not accept broad electronics labels as an audio product match", () => {
  const airpodsOrder = orderProofHistory[0];
  const comparison = compareLabelsToExpectedItem(
    [
      {
        name: "Mobile Phone",
        confidence: 99,
        parents: ["Electronics"],
      },
      {
        name: "Cell Phone",
        confidence: 98,
        parents: ["Phone", "Electronics"],
      },
    ],
    {
      item: {
        title: airpodsOrder.title,
        brandLine: airpodsOrder.model,
        variant: airpodsOrder.variant,
        sku: airpodsOrder.asin,
        category: airpodsOrder.category,
      },
    },
  );

  assert.equal(comparison.identityStatus, "mismatch");
  assert.equal(comparison.relevant.length, 0);
});
