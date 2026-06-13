# Demo Script

## Opening

NexTurn solves the moment where a customer has a usable return but does not know
the best next step. Instead of treating returns as a black-box warehouse flow,
the app gives the customer a transparent, value-aware, sustainable choice.

## Flow

1. Open the connected return case for the headphones.
2. Point out the scan evidence: uploaded media, inspection progress, defects,
   accessories, and the A- quality grade.
3. Explain that the recommendation is not generic resale. It weighs condition,
   demand, payout, convenience, fraud risk, sustainability, and customer value.
4. Select a different route such as donation or exchange, then show the Trust
   Passport and green-credit bar update immediately.
5. Return to the recommended resell route and show buyer matches. The next buyer
   receives trust signals instead of guessing condition from a listing.
6. Show the Purchase fit check. This is the prevention layer: NexTurn recommends
   lower-risk refurbished alternatives before the next purchase creates another
   return.

## Judge-Facing Highlights

- Real customer problem: return uncertainty, refund friction, and low trust in
  refurbished goods.
- Working implementation: interactive React UI, deterministic scoring,
  Lambda-compatible API, DynamoDB adapter, CDK stack, CI, and tests.
- AWS usage: Lambda, HTTP API, DynamoDB, S3-ready build, CloudWatch logs, and
  CDK in `us-east-1`.
- Unique angle: return resolution and return prevention in one customer journey.
- Free Tier posture: no always-on servers, on-demand DynamoDB, small Lambda, and
  destroyable infrastructure.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run smoke:api
npm run cdk:synth
```
