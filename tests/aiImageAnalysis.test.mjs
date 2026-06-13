import test from "node:test";
import assert from "node:assert/strict";
import { analyzeReturnImage, decodeImagePayload } from "../backend/lib/aiImageAnalysis.js";
import { returnCase } from "../src/data/returnCase.js";

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
