import { handler } from "../backend/lambda/returnResolution.js";

const calls = [
  {
    name: "fetch case",
    event: {
      rawPath: "/case",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "fetch orders",
    event: {
      rawPath: "/orders",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "fetch resale queue",
    event: {
      rawPath: "/resale",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "fetch wallet",
    event: {
      rawPath: "/wallet",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "fetch messages",
    event: {
      rawPath: "/messages",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "fetch impact",
    event: {
      rawPath: "/impact",
      requestContext: { http: { method: "GET" } },
    },
  },
  {
    name: "evaluate scan",
    event: {
      rawPath: "/scan/evaluate",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        cosmeticWear: 7,
        functionalScore: 96,
        accessoryCompleteness: 100,
        hygieneScore: 93,
        demandScore: 88,
      }),
    },
  },
  {
    name: "select route",
    event: {
      rawPath: "/route",
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({ routeId: "resell" }),
    },
  },
  {
    name: "connect exchange",
    event: {
      rawPath: "/exchange/connect",
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "smoke-user",
              email: "smoke@example.com",
              name: "Smoke User",
            },
          },
        },
        http: { method: "POST" },
      },
      body: JSON.stringify({ alternativeId: "alt_qc" }),
    },
  },
];

for (const call of calls) {
  const response = await handler(call.event);
  const body = JSON.parse(response.body || "{}");
  if (response.statusCode >= 400) {
    throw new Error(`${call.name} failed: ${response.statusCode}`);
  }
  console.log(
    `${call.name}: ${response.statusCode}`,
    body.decision?.recommended?.id ??
      body.recommendedRoute?.id ??
      body.selectedRoute?.id ??
      body.exchangeIntent?.alternativeId ??
      body.orders?.length ??
      body.buyerMatches?.length ??
      body.events?.length ??
      body.messages?.length ??
      body.impact?.nextOwnerMatchRate,
  );
}
