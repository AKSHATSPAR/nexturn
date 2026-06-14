# Amazon Integration Path

NexTurn is designed as a direct Customer-to-Customer layer beside Amazon's
commerce and returns experience. The important product rule is that no warehouse
is involved: the item stays with the seller until a buyer purchases it.

## Prototype Boundary

The prototype cannot connect to a real Amazon account, so it uses a hardcoded
fake Amazon order history in `src/data/c2cCommerce.js`. That seeded history is
the authenticity anchor for the demo:

- order ID;
- ASIN;
- original price;
- purchase date;
- pristine original product image;
- package contents;
- proof note.

This lets judges see how real Amazon order data would prove ownership and reduce
buyer anxiety without requiring private Amazon APIs.

## Direct C2C Flow

1. **Seller proof**: signed-in seller selects an item from fake Amazon order
   history.
2. **Real item evidence**: seller uploads a current product photo.
3. **AI and scorecard**: Rekognition checks visual evidence and NexTurn's
   deterministic scorecard assigns grade and resale price.
4. **Marketplace listing**: item is listed with "AI Graded & Amazon Verified"
   badge.
5. **No warehouse hold**: seller keeps the item at home.
6. **Buyer inspection**: buyer sees order proof, scorecard, discount, and
   delivery fee before checkout.
7. **Mock checkout**: buyer pays discounted price plus Amazon Delivery Fee.
8. **Facilitated delivery**: Amazon delivery partner verifies quality at seller
   pickup and delivers to buyer.

## Production Adapter Flow

In production, the fake order data becomes an adapter to Amazon order context:

1. Import order ID, ASIN, SKU, product image, purchase price, return eligibility,
   customer identity, and package contents.
2. Use S3 for seller upload media and Rekognition for visual evidence.
3. Persist listing, grade, AI evidence, seller, and checkout records in DynamoDB.
4. Keep listing inventory with the seller until checkout.
5. Trigger Amazon local delivery after payment simulation or real payment.
6. Let the delivery partner verify item quality at pickup against the AI
   scorecard and uploaded evidence.

## Why This Is Customer-Centric

- Sellers recover value without mailing usable items to a warehouse first.
- Buyers get proof-backed second-hand items instead of anonymous listings.
- The platform clearly separates seller payment from Amazon's delivery fee.
- Trust improves because the original purchase, current condition, and pickup
  verification are visible before checkout.
- Sustainability improves because unnecessary warehouse movement is avoided.

## Free Tier Fit

- HTTP API + Lambda for the API surface.
- DynamoDB on-demand for listings and receipts.
- S3 for uploaded scan media.
- Cognito Hosted UI for unified buyer/seller accounts and Google federation.
- Rekognition `DetectLabels` for practical AWS AI evidence.
