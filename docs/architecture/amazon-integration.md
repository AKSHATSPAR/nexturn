# Amazon Integration Path

NexTurn is designed to sit beside Amazon's return and renewed-commerce journeys,
while the hackathon prototype stays buildable with AWS Free Tier resources.

## Prototype Boundary

The current build uses a seeded connected-order case in `src/data/returnCase.js`.
That keeps the customer flow demoable without private marketplace credentials.
The backend and UI already treat the case as adapter-fed data, so real Amazon
inputs can replace the seed without changing the customer workflow.

## Production Adapter Flow

1. **Order context**: import order ID, item SKU, price, return window, customer
   fit preferences, and refund/exchange eligibility from an Amazon order/returns
   adapter.
2. **Return media**: store customer-uploaded images and videos in S3, then pass
   derived scan signals into the decision engine.
3. **Quality intelligence**: use Rekognition-style image checks for visible
   condition signals and Bedrock-style explainability summaries where allowed.
   The deterministic engine remains the final customer-visible scoring layer.
4. **Route execution**: write resale, exchange, donation, or recycling decisions
   to DynamoDB and expose route queues through the `RouteQueueIndex`.
5. **Trusted resale**: attach the Trust Passport to renewed or peer-to-peer
   listings so buyers see authenticity, function test, cleaning, and warranty
   status.
6. **Return prevention**: use the customer's return/fit profile to rank
   certified refurbished alternatives before the next purchase.

## Why This Is Customer-Centric

- The customer gets a clear recommendation, not a hidden warehouse decision.
- Every route shows personal value: payout, credits, speed, and trust.
- Refurbished recommendations are ranked by likely fit, lowering the chance of
  another avoidable return.
- Trust Passport details reduce the buyer anxiety that usually blocks
  second-hand purchases.

## Free Tier Fit

- HTTP API + Lambda handles prototype traffic without running servers.
- DynamoDB on-demand keeps low-volume usage inexpensive.
- S3 is reserved for static assets and future scan media.
- CDK keeps the stack reproducible and easy to destroy after judging.
