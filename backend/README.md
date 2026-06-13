# NexTurn Backend

The prototype backend is a Lambda-compatible API layer that keeps the same
deterministic decision engine used by the frontend. It is intentionally small:
all demo paths can run locally, and the handler can be deployed behind API
Gateway on AWS Free Tier.

## Endpoints

- `GET /case` returns the connected order, return scan state, decision summary,
  buyer matches, refurbished alternatives, and trust passport checks.
- `POST /scan/evaluate` accepts scan signal overrides and returns a fresh grade
  and route ranking.
- `POST /route` locks the customer-selected route and returns a passport update
  plus green-credit preview.

## Why Deterministic First

The demo should never depend on a vague AI promise. The rules are explicit,
repeatable, and explainable. Rekognition or Bedrock can enrich the scan signals
later, but the core customer decision remains stable and testable.

## Local Invocation Fixtures

The `backend/events/` folder contains API Gateway v2-shaped sample events for
the three implemented paths. They are useful for Lambda console tests, local
debugging, and demo scripts.
