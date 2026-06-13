import { buyerMatches, refurbishedAlternatives, returnCase } from "../../src/data/returnCase.js";
import { summarizeDecision } from "../../src/lib/decisionEngine.js";
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
  const workingCase = {
    ...returnCase,
    scan: {
      ...returnCase.scan,
      ...(overrides.scan ?? {}),
    },
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
  const payload = createCasePayload({
    scan: {
      cosmeticWear: Number(body.cosmeticWear ?? returnCase.scan.cosmeticWear),
      functionalScore: Number(body.functionalScore ?? returnCase.scan.functionalScore),
      accessoryCompleteness: Number(
        body.accessoryCompleteness ?? returnCase.scan.accessoryCompleteness,
      ),
      hygieneScore: Number(body.hygieneScore ?? returnCase.scan.hygieneScore),
      packagingScore: Number(body.packagingScore ?? returnCase.scan.packagingScore),
      fraudRisk: Number(body.fraudRisk ?? returnCase.scan.fraudRisk),
      demandScore: Number(body.demandScore ?? returnCase.scan.demandScore),
    },
  });
  const persistence = await saveScanEvaluation(
    payload.case,
    payload.decision.grade,
    payload.decision.recommended,
  );

  return json(200, {
    grade: payload.decision.grade,
    recommendedRoute: payload.decision.recommended,
    routes: payload.decision.routes,
    inspectionSignals: payload.case.scan.inspectionSignals,
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

  if (method === "POST" && path.endsWith("/route")) {
    const body = parseBody(event);
    return selectRoute(body.routeId);
  }

  if (method === "POST" && path.endsWith("/scan/evaluate")) {
    return evaluateScan(parseBody(event));
  }

  return json(404, {
    error: "Route not found",
    routes: ["GET /case", "POST /route", "POST /scan/evaluate"],
  });
}
