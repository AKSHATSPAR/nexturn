import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../backend/lambda/returnResolution.js";

process.env.NEX_TURN_DISABLE_PUBLIC_MARKETPLACE = "true";

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

function authenticatedEvent(rawPath, method = "GET", body) {
  return {
    rawPath,
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "c2c-user-123",
            email: "c2c@example.com",
            name: "C2C Customer",
          },
        },
      },
      http: { method },
    },
    body: body ? JSON.stringify(body) : undefined,
  };
}

const completeProfile = {
  address: {
    addressLine: "21 Race Course Road",
    city: "Vadodara",
    state: "Gujarat",
    country: "IN",
    pincode: "390007",
  },
};

test("c2c order history requires auth and returns five proof-backed orders", async () => {
  const unauthenticated = await handler({
    rawPath: "/c2c/orders",
    requestContext: { http: { method: "GET" } },
  });
  const response = await handler(authenticatedEvent("/c2c/orders"));
  const body = JSON.parse(response.body);

  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(response.statusCode, 200);
  assert.equal(body.orders.length, 5);
  assert.equal(body.accountMode, "unified_buyer_seller");
  assert.ok(body.orders[0].authenticity.purchasedNew);
});

test("c2c marketplace injects ai-graded listings into a large public feed", async () => {
  const response = await handler({
    rawPath: "/c2c/marketplace",
    requestContext: { http: { method: "GET" } },
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.ok(body.heroListings.length >= 3);
  assert.ok(body.genericItems.length >= 100);
  assert.equal(body.heroListings[0].badge, "AI Graded & Amazon Verified");
  assert.match(body.marketplaceRule, /no warehouse/i);
});

test("c2c cracked screen evaluation produces a low condition grade", async () => {
  const response = await handler(
    authenticatedEvent("/c2c/listings/evaluate", "POST", {
      orderId: "114-8829301-2210045",
      fileName: "broken-screen-phone.jpg",
      profile: completeProfile,
    }),
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.listingPreview.grade.grade, "C");
  assert.ok(body.listingPreview.scorecard.damageFlags.includes("broken_screen"));
  assert.ok(body.listingPreview.price < body.order.originalPrice * 0.35);
  assert.equal(body.listingPreview.review.paymentUnlocked, false);
});

test("c2c interest queue locks payment until pickup review", async () => {
  const response = await handler(
    authenticatedEvent("/c2c/interest", "POST", {
      listingId: "seed_listing_airpods_max",
      profile: completeProfile,
    }),
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.interest.status, "queued_for_pickup_review");
  assert.equal(body.interest.paymentStatus, "locked_until_pickup_review");
  assert.ok(body.interest.estimatedDeliveryFee >= 79);
  assert.match(body.customerMessage, /payment remains locked/i);
});

test("c2c checkout is locked before manual pickup verification", async () => {
  const response = await handler(
    authenticatedEvent("/c2c/checkout", "POST", {
      listingId: "seed_listing_airpods_max",
      buyerLocation: completeProfile.address,
    }),
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 409);
  assert.match(body.message, /pickup/i);
});
