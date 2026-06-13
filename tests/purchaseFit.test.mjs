import assert from "node:assert/strict";
import test from "node:test";
import { refurbishedAlternatives, returnCase } from "../src/data/returnCase.js";
import { rankPurchaseFit } from "../src/lib/purchaseFit.js";

test("ranks refurbished alternatives by low-return customer fit", () => {
  const ranking = rankPurchaseFit(refurbishedAlternatives, returnCase.customer);

  assert.equal(ranking[0].name, "QuietPlus Fold 45");
  assert.equal(ranking[0].recommendation, "Best low-return match");
  assert.ok(ranking[0].confidence > ranking[1].confidence);
});

test("keeps return risk visible for the selected recommendation", () => {
  const [bestFit] = rankPurchaseFit(refurbishedAlternatives, returnCase.customer);

  assert.equal(typeof bestFit.returnRisk, "number");
  assert.ok(bestFit.returnRisk < 15);
});
