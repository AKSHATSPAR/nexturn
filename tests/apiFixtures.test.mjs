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
  assert.equal(body.aiAnalysis.provider, "rules-engine");
  assert.equal(body.aiAnalysis.mode, "no-upload");
});

test("route fixture locks the selected route", async () => {
  const response = await handler(await readFixture("select-route.json"));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.selectedRoute.id, "resell");
  assert.equal(body.passport.lockedRoute, "Resell");
});

test("exchange endpoint connects a refurbished alternative to the order", async () => {
  const response = await handler({
    rawPath: "/exchange/connect",
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "test-user-123",
            email: "customer@example.com",
            name: "Customer Example",
          },
        },
      },
      http: { method: "POST" },
    },
    body: JSON.stringify({ alternativeId: "alt_qc" }),
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.exchangeIntent.alternativeId, "alt_qc");
  assert.equal(body.exchangeIntent.originalOrderId, "113-9876547-2212210");
  assert.equal(body.exchangeIntent.status, "connected_to_order");
});

test("authenticated case payload scopes records to Cognito identity", async () => {
  const response = await handler({
    rawPath: "/case",
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "test-user-456",
            email: "signed@example.com",
            name: "Signed Customer",
          },
        },
      },
      http: { method: "GET" },
    },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.identity.customerId, "cognito#test-user-456");
  assert.equal(body.case.customer.email, "signed@example.com");
});

test("customer workspace endpoints return page data", async () => {
  const endpoints = [
    ["/orders", "orders"],
    ["/resale", "buyerMatches"],
    ["/wallet", "events"],
    ["/messages", "messages"],
    ["/impact", "impact"],
  ];

  for (const [rawPath, key] of endpoints) {
    const response = await handler({
      rawPath,
      requestContext: { http: { method: "GET" } },
    });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.ok(body[key]);
  }
});
