import assert from "node:assert/strict";
import test from "node:test";
import { returnCase } from "../src/data/returnCase.js";
import { gradeReturn, summarizeDecision } from "../src/lib/decisionEngine.js";

test("grades high-quality complete returns as A-", () => {
  const grade = gradeReturn(returnCase.scan);

  assert.equal(grade.grade, "A-");
  assert.equal(grade.confidence, "High confidence");
  assert.ok(grade.score >= 90);
});

test("recommends resale for high-demand high-grade usable item", () => {
  const decision = summarizeDecision(returnCase);

  assert.equal(decision.recommended.id, "resell");
  assert.equal(decision.routes[0].isRecommended, true);
  assert.ok(decision.routes[0].score > decision.routes[1].score);
});

test("includes sustainability impact in the customer decision", () => {
  const decision = summarizeDecision(returnCase);

  assert.ok(decision.impact.emissionsKgSaved > 0);
  assert.ok(decision.impact.landfillAvoidedGrams > 0);
  assert.equal(decision.impact.nextOwnerMatchRate, returnCase.scan.demandScore);
});
