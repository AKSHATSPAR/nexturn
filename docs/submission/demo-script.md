# Demo Script

## Opening

NexTurn solves the moment where a customer has a usable return but does not know
the best next step. Instead of treating returns as a black-box warehouse flow,
the app gives the customer a transparent, value-aware, sustainable choice.

## Flow

1. Sign in and save an India delivery address in Profile.
2. Open Sell / Return Items and choose a product from Amazon order proof history.
3. Upload a current item photo and point out that AWS Rekognition compares the
   upload against order metadata, original image evidence, colour/variant, and
   damage risk.
4. Publish the listing and explain the core C2C rule: no warehouse, the seller
   keeps the item at home.
5. Open Marketplace from another signed-in account, inspect the original purchase
   date, seller location, preliminary value, and delivery estimate.
6. Join the buyer queue. No payment is collected until an Amazon delivery
   partner manually verifies the item at pickup.

## Judge-Facing Highlights

- Real customer problem: return uncertainty, refund friction, and low trust in
  refurbished goods.
- Working implementation: interactive React UI, deterministic scoring,
  Lambda-compatible API, DynamoDB adapter, CDK stack, CI, and tests.
- AWS usage: Lambda, HTTP API, DynamoDB, S3-ready build, CloudWatch logs, and
  CDK in `us-east-1`.
- Unique angle: order-proof-backed C2C resale with no warehouse hold and
  payment locked until pickup verification.
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
