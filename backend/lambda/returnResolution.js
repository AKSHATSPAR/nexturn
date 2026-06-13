import {
  buyerMatches,
  creditEvents,
  customerMessages,
  orderHistory,
  refurbishedAlternatives,
  returnCase,
} from "../../src/data/returnCase.js";
import { summarizeDecision } from "../../src/lib/decisionEngine.js";
import { analyzeReturnImage } from "../lib/aiImageAnalysis.js";
import {
  saveRouteSelection,
  saveScanEvaluation,
} from "../lib/dynamodbRepository.js";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
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

function createCasePayload(overrides = {}) {
  const scan = {
    ...returnCase.scan,
    ...(overrides.scan ?? {}),
  };
  const workingCase = {
    ...returnCase,
    scan,
  };
  const decision = summarizeDecision(workingCase);

  return {
    case: workingCase,
    decision,
    buyerMatches,
    refurbishedAlternatives,
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

async function selectRoute(routeId) {
  const payload = createCasePayload();
  const selected = payload.decision.routes.find((route) => route.id === routeId);

  if (!selected) {
    return json(422, {
      error: "Unsupported route",
      supportedRoutes: payload.decision.routes.map((route) => route.id),
    });
  }

  const persistence = await saveRouteSelection(returnCase, selected);

  return json(200, {
    selectedRoute: selected,
    passport: {
      ...returnCase.trustPassport,
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

async function evaluateScan(body) {
  const { aiAnalysis, media } = await analyzeReturnImage({
    returnCase,
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    fileName: body.fileName,
  });
  const inspectionSignals = mergeInspectionSignals(
    returnCase.scan.inspectionSignals,
    aiAnalysis.inspectionSignals,
  );
  const payload = createCasePayload({
    scan: {
      imagesUploaded: body.imageBase64
        ? returnCase.scan.imagesUploaded + 1
        : returnCase.scan.imagesUploaded,
      cosmeticWear: numberOrFallback(body.cosmeticWear, returnCase.scan.cosmeticWear),
      functionalScore: numberOrFallback(body.functionalScore, returnCase.scan.functionalScore),
      accessoryCompleteness: numberOrFallback(
        body.accessoryCompleteness,
        returnCase.scan.accessoryCompleteness,
      ),
      hygieneScore: numberOrFallback(body.hygieneScore, returnCase.scan.hygieneScore),
      packagingScore: numberOrFallback(body.packagingScore, returnCase.scan.packagingScore),
      fraudRisk: numberOrFallback(body.fraudRisk, returnCase.scan.fraudRisk),
      demandScore: numberOrFallback(body.demandScore, returnCase.scan.demandScore),
      inspectionSignals,
    },
  });
  const persistence = await saveScanEvaluation(
    payload.case,
    payload.decision.grade,
    payload.decision.recommended,
    aiAnalysis,
    media,
  );

  return json(200, {
    case: payload.case,
    grade: payload.decision.grade,
    recommendedRoute: payload.decision.recommended,
    routes: payload.decision.routes,
    inspectionSignals: payload.case.scan.inspectionSignals,
    aiAnalysis,
    media,
    persistence,
  });
}

export async function handler(event = {}) {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = normalizePath(event);

  if (method === "GET" && path.endsWith("/case")) {
    return json(200, createCasePayload());
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
    const payload = createCasePayload();
    return json(200, {
      impact: payload.decision.impact,
      routes: payload.decision.routes,
    });
  }

  if (method === "POST" && path.endsWith("/route")) {
    const body = parseBody(event);
    return selectRoute(body.routeId);
  }

  if (method === "POST" && path.endsWith("/scan/evaluate")) {
    return evaluateScan(parseBody(event));
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
      "POST /route",
      "POST /scan/evaluate",
    ],
  });
}
