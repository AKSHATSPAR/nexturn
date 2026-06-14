# NexTurn Backend

The backend is a Lambda-compatible API layer for direct Customer-to-Customer
commerce. It keeps NexTurn's final decisions explainable: AWS Rekognition
provides image evidence, while deterministic comparison rules decide product
match, colour/variant match, preliminary grade, resale value, and listing
status.

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
- `GET /c2c/profile` returns the signed-in customer's saved buyer/seller address.
- `POST /c2c/profile` validates and saves an India delivery address. Selling and
  buyer-queue actions require this profile.
- `GET /c2c/orders` returns the signed-in customer's Amazon order proof history.
- `POST /c2c/listings/evaluate` grades a selected order item and returns a
  listing preview without publishing it.
- `POST /c2c/listings` grades and publishes a C2C listing globally.
- `GET /c2c/marketplace` returns persisted NexTurn listings plus 100+ public API
  background items.
- `GET /c2c/listing?listingId=...` returns one listing with order proof, original
  purchase date, preliminary AI review, original image, seller-upload image,
  seller location, green credits, and delivery estimate.
- `POST /c2c/interest` adds the first buyer to the queue. Payment remains locked
  until pickup verification, and later buyers receive a queue-filled conflict.
- `POST /c2c/checkout` is reserved for the future payment-unlocked state and
  currently returns a payment-locked response unless manual pickup review has
  opened payment.

On AWS, buy/sell mutation routes are protected by a Cognito JWT authorizer.
Marketplace browsing remains public, but listing creation and buyer queue entry
require a signed-in account with a complete India address.

## Why Deterministic First

The demo should never depend on a vague AI promise. The rules are explicit,
repeatable, and explainable. Rekognition enriches the scan evidence from a real
AWS AI call, but the core customer decision remains stable and testable.

For C2C listings, the backend compares the upload against Amazon order proof
metadata and the original order image when possible. Damage-aware scoring means
a broken or visually distant product receives a low grade such as `C`, not an
unearned high-confidence `A`. A colour or variant mismatch also prevents an `A`
grade and forces the flow into manual pickup review before payment can open.

## Local Invocation Fixtures

The `backend/events/` folder contains API Gateway v2-shaped sample events for
the core paths. They are useful for Lambda console tests, local debugging, and
demo scripts.
