import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../backend/lambda/returnResolution.js";

async function readFixture(name) {
  const file = await readFile(join("backend", "events", name), "utf8");
  return JSON.parse(file);
}

test("case fixture returns a recommended route", async () => {
  const response = await handler(await readFixture("get-case.json"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.decision.recommended.id, "resell");
});

test("scan fixture returns grade and ranked routes", async () => {
  const response = await handler(await readFixture("evaluate-scan.json"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.grade.grade, "A-");
  assert.equal(body.recommendedRoute.id, "resell");
  assert.ok(body.routes.length >= 4);
});

test("route fixture locks the selected route", async () => {
  const response = await handler(await readFixture("select-route.json"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.selectedRoute.id, "resell");
  assert.equal(body.passport.lockedRoute, "Resell");
});
