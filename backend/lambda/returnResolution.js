import {
  buyerMatches,
  creditEvents,
  customerMessages,
  orderHistory,
  refurbishedAlternatives,
  returnCase,
} from "../../src/data/returnCase.js";
import { formatCurrency, summarizeDecision } from "../../src/lib/decisionEngine.js";
import { analyzeReturnImage } from "../lib/aiImageAnalysis.js";
import {
  getC2CListing,
  listC2CListings,
  saveC2CCheckout,
  saveC2CListing,
  saveExchangeConnection,
  saveRouteSelection,
  saveScanEvaluation,
} from "../lib/dynamodbRepository.js";
import {
  buildFallbackMarketplace,
  buildGenericFallbackItems,
  createCheckoutReceipt,
  createListingFromEvaluation,
  findCustomerOrder,
  mergeMarketplaceListings,
  ordersForCustomer,
} from "../../src/lib/c2cCommerce.js";
import { seedC2CListings } from "../../src/data/c2cCommerce.js";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function normalizePath(event) {
  return event.rawPath ?? event.path ?? "/";
}

function getIdentity(event = {}) {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const email = claims.email ?? returnCase.customer.email;
  const name = claims.name ?? claims.given_name ?? email?.split("@")[0] ?? returnCase.customer.name;

  if (!claims.sub) {
    return {
      isAuthenticated: false,
      customerId: returnCase.customer.id,
      email,
      name: returnCase.customer.name,
    };
  }

  return {
    isAuthenticated: true,
    subject: claims.sub,
    customerId: `cognito#${claims.sub}`,
    email,
    name,
  };
}

function requireIdentity(event) {
  const identity = getIdentity(event);
  if (!identity.isAuthenticated) {
    return {
      error: json(401, {
        error: "Authentication required",
        message: "Sign in to use NexTurn C2C buying and selling.",
      }),
      identity,
    };
  }

  return { identity };
}

function caseForIdentity(identity) {
  return {
    ...returnCase,
    customer: {
      ...returnCase.customer,
      id: identity.customerId,
      name: identity.name,
      email: identity.email,
    },
  };
}

function createCasePayload(overrides = {}, identity = getIdentity()) {
  const baseCase = caseForIdentity(identity);
  const scan = {
    ...baseCase.scan,
    ...(overrides.scan ?? {}),
  };
  const workingCase = {
    ...baseCase,
    scan,
  };
  const decision = summarizeDecision(workingCase);

  return {
    case: workingCase,
    decision,
    buyerMatches,
    refurbishedAlternatives,
    identity: {
      isAuthenticated: identity.isAuthenticated,
      customerId: identity.customerId,
      email: identity.email,
    },
    generatedAt: new Date().toISOString(),
  };
}

function numberOrFallback(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeInspectionSignals(existingSignals, aiSignals) {
  return [...new Set([...(existingSignals ?? []), ...(aiSignals ?? [])])];
}

function orderToReturnCase(order, identity) {
  return {
    id: `c2c_${order.id}`,
    customer: {
      id: identity.customerId,
      name: identity.name,
      email: identity.email,
    },
    item: {
      sku: order.asin,
      title: order.title,
      brandLine: order.model,
      variant: order.variant,
      originalPrice: order.originalPrice,
      estimatedWeightKg: order.estimatedWeightKg,
      category: order.category,
      image: order.image,
      gallery: [order.image],
    },
  };
}

async function fetchGenericMarketplaceItems() {
  if (process.env.NEX_TURN_DISABLE_PUBLIC_MARKETPLACE === "true") {
    return {
      source: "local-fallback",
      items: buildGenericFallbackItems(),
    };
  }

  try {
    const response = await fetch("https://dummyjson.com/products?limit=120&select=id,title,price,thumbnail,category,rating");
    if (!response.ok) throw new Error(`DummyJSON returned ${response.status}`);
    const payload = await response.json();
    const items = (payload.products ?? []).map((product) => ({
      id: `dummy_${product.id}`,
      source: "dummyjson",
      title: product.title,
      category: product.category,
      price: product.price,
      image: product.thumbnail,
      rating: product.rating,
      badge: "Marketplace item",
    }));

    if (items.length >= 100) {
      return {
        source: "dummyjson",
        items,
      };
    }
  } catch {
    // Fall through to deterministic local filler so the marketplace never looks empty.
  }

  return {
    source: "local-fallback",
    items: buildGenericFallbackItems(),
  };
}

async function buildMarketplacePayload() {
  const [listingResult, genericResult] = await Promise.all([
    listC2CListings(),
    fetchGenericMarketplaceItems(),
  ]);
  const merged = mergeMarketplaceListings(listingResult.listings, genericResult.items);

  return {
    ...merged,
    persistence: {
      mode: listingResult.mode,
      persisted: listingResult.persisted,
    },
    genericSource: genericResult.source,
    marketplaceRule:
      "Direct C2C: no warehouse. Seller keeps the item until a buyer pays, then Amazon facilitates pickup, quality check, and delivery.",
  };
}

async function evaluateC2CListing(body, event, { persist = false } = {}) {
  const auth = requireIdentity(event);
  if (auth.error) return auth.error;

  const order = findCustomerOrder(body.orderId, auth.identity);
  if (!order) {
    return json(404, {
      error: "Order not found",
      message: "Choose an item from the signed-in customer's fake Amazon order history.",
    });
  }

  const sellerCondition = {
    ...(body.sellerCondition ?? {}),
    fileName: body.fileName,
  };
  const { aiAnalysis, media } = await analyzeReturnImage({
    returnCase: orderToReturnCase(order, auth.identity),
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    fileName: body.fileName,
  });
  const listing = createListingFromEvaluation({
    aiAnalysis,
    identity: auth.identity,
    media,
    order,
    sellerCondition,
    uploadedImagePreview: body.imageBase64,
  });

  if (!persist) {
    return json(200, {
      order,
      listingPreview: listing,
      aiAnalysis,
      media,
      customerMessage:
        "AI grading complete. The item is still with you; list it only when you are ready for buyer checkout and pickup.",
    });
  }

  if (!listing.publishable) {
    return json(422, {
      error: "Item photo does not match order",
      listingPreview: listing,
      aiAnalysis,
      media,
      customerMessage:
        "This photo appears to be a different product than the selected Amazon order item. Choose the matching order or upload the correct item photo before listing.",
    });
  }

  const persistence = await saveC2CListing({
    ...listing,
    uploadedImagePreview: undefined,
  });

  return json(201, {
    listing: {
      ...listing,
      uploadedImagePreview: undefined,
    },
    aiAnalysis,
    media,
    persistence,
    customerMessage:
      "Listed on NexTurn Marketplace. Keep the item at home until a buyer purchases it; Amazon delivery verifies quality at pickup.",
  });
}

async function getC2CListingPayload(listingId) {
  if (!listingId) {
    return json(422, {
      error: "listingId is required",
    });
  }

  const persisted = await getC2CListing(listingId);
  const listing =
    persisted.listing ?? seedC2CListings.find((item) => item.id === listingId) ?? null;

  if (!listing) {
    return json(404, {
      error: "Listing not found",
    });
  }

  return json(200, {
    listing,
    persistence: {
      mode: persisted.mode,
      persisted: Boolean(persisted.listing),
    },
  });
}

async function checkoutC2CListing(body, event) {
  const auth = requireIdentity(event);
  if (auth.error) return auth.error;

  const persisted = await getC2CListing(body.listingId);
  const listing =
    persisted.listing ?? seedC2CListings.find((item) => item.id === body.listingId) ?? null;

  if (!listing) {
    return json(404, {
      error: "Listing not found",
    });
  }

  if (listing.status !== "active") {
    return json(409, {
      error: "Listing unavailable",
      message: "This item is no longer available for C2C checkout.",
    });
  }

  if (listing.sellerId === auth.identity.customerId) {
    return json(422, {
      error: "Cannot buy your own listing",
      message: "Use a different signed-in buyer account to complete the C2C purchase.",
    });
  }

  const receipt = createCheckoutReceipt({
    buyerIdentity: auth.identity,
    listing,
  });
  const persistence = await saveC2CCheckout(listing, receipt);

  return json(200, {
    receipt,
    persistence,
    customerMessage:
      "Payment simulated. Item payment is assigned to the seller; Amazon delivery fee covers pickup, quality check, and buyer delivery.",
  });
}

async function selectRoute(routeId, event) {
  const payload = createCasePayload({}, getIdentity(event));
  const selected = payload.decision.routes.find((route) => route.id === routeId);

  if (!selected) {
    return json(422, {
      error: "Unsupported route",
      supportedRoutes: payload.decision.routes.map((route) => route.id),
    });
  }

  const persistence = await saveRouteSelection(payload.case, selected);

  return json(200, {
    selectedRoute: selected,
    passport: {
      ...payload.case.trustPassport,
      lockedRoute: selected.shortLabel,
      status: "ready_for_customer_confirmation",
    },
    creditPreview: selected.greenCredits,
    persistence,
    customerMessage:
      selected.id === "resell"
        ? "Your item can be matched to a trusted buyer with estimated payout in 2-3 days."
        : "Route selected. Confirm to generate the final customer receipt.",
  });
}

async function evaluateScan(body, event) {
  const identity = getIdentity(event);
  const customerCase = caseForIdentity(identity);
  const { aiAnalysis, media } = await analyzeReturnImage({
    returnCase: customerCase,
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    fileName: body.fileName,
  });
  const identityMismatch = aiAnalysis.identityStatus === "mismatch";
  const inspectionSignals = mergeInspectionSignals(
    customerCase.scan.inspectionSignals,
    [
      ...(aiAnalysis.inspectionSignals ?? []),
      ...(identityMismatch
        ? ["Manual review required because the uploaded evidence does not match the expected returned item"]
        : []),
    ],
  );
  const requestedDemandScore = numberOrFallback(body.demandScore, customerCase.scan.demandScore);
  const requestedFraudRisk = numberOrFallback(body.fraudRisk, customerCase.scan.fraudRisk);
  const scoredAiAnalysis = {
    ...aiAnalysis,
    gradeImpact: identityMismatch
      ? "The AWS label evidence did not match the expected item category, so NexTurn raised the fraud-risk signal before calculating the condition grade."
      : "AWS label evidence was used as identity/accessory context. The final grade is still calculated by the explainable condition scorecard.",
  };
  const payload = createCasePayload({
    scan: {
      imagesUploaded: body.imageBase64
        ? customerCase.scan.imagesUploaded + 1
        : customerCase.scan.imagesUploaded,
      cosmeticWear: numberOrFallback(body.cosmeticWear, customerCase.scan.cosmeticWear),
      functionalScore: numberOrFallback(body.functionalScore, customerCase.scan.functionalScore),
      accessoryCompleteness: numberOrFallback(
        body.accessoryCompleteness,
        customerCase.scan.accessoryCompleteness,
      ),
      hygieneScore: numberOrFallback(body.hygieneScore, customerCase.scan.hygieneScore),
      packagingScore: numberOrFallback(body.packagingScore, customerCase.scan.packagingScore),
      fraudRisk: identityMismatch ? Math.max(requestedFraudRisk, 75) : requestedFraudRisk,
      demandScore: identityMismatch ? Math.min(requestedDemandScore, 70) : requestedDemandScore,
      inspectionSignals,
    },
  }, identity);
  const persistence = await saveScanEvaluation(
    payload.case,
    payload.decision.grade,
    payload.decision.recommended,
    scoredAiAnalysis,
    media,
  );

  return json(200, {
    case: payload.case,
    grade: payload.decision.grade,
    recommendedRoute: payload.decision.recommended,
    routes: payload.decision.routes,
    inspectionSignals: payload.case.scan.inspectionSignals,
    aiAnalysis: scoredAiAnalysis,
    media,
    persistence,
  });
}

async function connectExchange(body, event) {
  const payload = createCasePayload({}, getIdentity(event));
  const alternative = refurbishedAlternatives.find((item) => item.id === body.alternativeId);

  if (!alternative) {
    return json(422, {
      error: "Unsupported exchange alternative",
      supportedAlternatives: refurbishedAlternatives.map((item) => item.id),
    });
  }

  const priceDelta = Number((alternative.price - payload.case.item.originalPrice).toFixed(2));
  const exchangeIntent = {
    id: `exchange_${payload.case.id}_${alternative.id}`,
    status: "connected_to_order",
    originalOrderId: payload.case.order.id,
    returnId: payload.case.id,
    alternativeId: alternative.id,
    alternativeName: alternative.name,
    alternativeLabel: alternative.label,
    fitScore: alternative.fit,
    expectedReturnRisk: alternative.returnRisk,
    priceDelta,
    customerCreditPreview: 2,
    customerMessage:
      priceDelta <= 0
        ? `${alternative.name} is now connected as a lower-risk exchange option for this return.`
        : `${alternative.name} is connected as an exchange option with a ${formatCurrency(priceDelta)} upgrade difference.`,
  };

  const persistence = await saveExchangeConnection(payload.case, alternative, exchangeIntent);

  return json(200, {
    exchangeIntent,
    persistence,
    customerMessage: exchangeIntent.customerMessage,
  });
}

export async function handler(event = {}) {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = normalizePath(event);

  if (method === "GET" && path.endsWith("/case")) {
    return json(200, createCasePayload({}, getIdentity(event)));
  }

  if (method === "GET" && path.endsWith("/c2c/orders")) {
    const auth = requireIdentity(event);
    if (auth.error) return auth.error;
    return json(200, {
      identity: auth.identity,
      orders: ordersForCustomer(auth.identity),
      accountMode: "unified_buyer_seller",
      customerMessage:
        "One NexTurn account can sell from Amazon order history and buy from the C2C marketplace.",
    });
  }

  if (method === "GET" && path.endsWith("/c2c/marketplace")) {
    return json(200, await buildMarketplacePayload());
  }

  if (method === "GET" && path.endsWith("/c2c/listing")) {
    return getC2CListingPayload(event.queryStringParameters?.listingId);
  }

  if (method === "POST" && path.endsWith("/c2c/listings/evaluate")) {
    return evaluateC2CListing(parseBody(event), event, { persist: false });
  }

  if (method === "POST" && path.endsWith("/c2c/listings")) {
    return evaluateC2CListing(parseBody(event), event, { persist: true });
  }

  if (method === "POST" && path.endsWith("/c2c/checkout")) {
    return checkoutC2CListing(parseBody(event), event);
  }

  if (method === "GET" && path.endsWith("/orders")) {
    return json(200, { orders: orderHistory });
  }

  if (method === "GET" && path.endsWith("/resale")) {
    return json(200, {
      buyerMatches,
      refurbishedAlternatives,
      generatedAt: new Date().toISOString(),
    });
  }

  if (method === "GET" && path.endsWith("/wallet")) {
    return json(200, {
      balance: returnCase.customer.creditsBalance,
      estimatedValue: returnCase.customer.creditsValue,
      events: creditEvents,
    });
  }

  if (method === "GET" && path.endsWith("/messages")) {
    return json(200, { messages: customerMessages });
  }

  if (method === "GET" && path.endsWith("/impact")) {
    const payload = createCasePayload({}, getIdentity(event));
    return json(200, {
      impact: payload.decision.impact,
      routes: payload.decision.routes,
    });
  }

  if (method === "GET" && path.endsWith("/me")) {
    return json(200, { identity: getIdentity(event) });
  }

  if (method === "POST" && path.endsWith("/route")) {
    const body = parseBody(event);
    return selectRoute(body.routeId, event);
  }

  if (method === "POST" && path.endsWith("/scan/evaluate")) {
    return evaluateScan(parseBody(event), event);
  }

  if (method === "POST" && path.endsWith("/exchange/connect")) {
    return connectExchange(parseBody(event), event);
  }

  return json(404, {
    error: "Route not found",
    routes: [
      "GET /case",
      "GET /orders",
      "GET /resale",
      "GET /wallet",
      "GET /messages",
      "GET /impact",
      "GET /me",
      "GET /c2c/orders",
      "GET /c2c/marketplace",
      "GET /c2c/listing?listingId=...",
      "POST /c2c/listings/evaluate",
      "POST /c2c/listings",
      "POST /c2c/checkout",
      "POST /route",
      "POST /scan/evaluate",
      "POST /exchange/connect",
    ],
  });
}
