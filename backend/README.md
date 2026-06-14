# NexTurn Backend

The backend is a Lambda-compatible API layer for direct Customer-to-Customer
commerce. It keeps NexTurn's final decisions explainable: AWS Rekognition
provides image evidence, while deterministic scorecards decide grade, resale
price, listing status, and checkout split.

## Endpoints

- `GET /case` returns the connected order, return scan state, decision summary,
  buyer matches, refurbished alternatives, and trust passport checks.
- `GET /orders`, `/resale`, `/wallet`, `/messages`, and `/impact` return the data
  behind the customer workspace pages.
- `POST /scan/evaluate` accepts scan signal overrides plus an optional uploaded
  image data URL. In AWS it stores the image in S3, calls Amazon Rekognition
  `DetectLabels`, persists the scan evaluation in DynamoDB, and returns a fresh
  grade, route ranking, media metadata, and AI evidence.
- `POST /route` locks the customer-selected route and returns a passport update
  plus green-credit preview.
- `POST /exchange/connect` links a certified refurbished alternative to the
  original order as a persisted exchange intent.
- `GET /me` returns the Cognito-derived customer identity for protected flows.
- `GET /c2c/orders` returns the signed-in customer's fake Amazon order history.
- `POST /c2c/listings/evaluate` grades a selected order item and returns a
  listing preview without publishing it.
- `POST /c2c/listings` grades and publishes a C2C listing globally.
- `GET /c2c/marketplace` returns persisted NexTurn listings plus 100+ public API
  background items.
- `GET /c2c/listing?listingId=...` returns one listing with proof and scorecard.
- `POST /c2c/checkout` simulates buyer payment, persists a receipt, marks a
  persisted listing sold, and schedules pickup from the seller home.

On AWS, buy/sell mutation routes are protected by a Cognito JWT authorizer.
Marketplace browsing remains public, but checkout and listing creation require a
signed-in account.

## Why Deterministic First

The demo should never depend on a vague AI promise. The rules are explicit,
repeatable, and explainable. Rekognition enriches the scan evidence from a real
AWS AI call, but the core customer decision remains stable and testable.

For C2C listings, the backend compares the upload against fake Amazon order
metadata. Damage-aware scoring means a broken-screen phone path receives a low
grade such as `C`, not a fake high-confidence `A`.

## Local Invocation Fixtures

The `backend/events/` folder contains API Gateway v2-shaped sample events for
the core paths. They are useful for Lambda console tests, local debugging, and
demo scripts.
