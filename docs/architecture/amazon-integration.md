# Amazon Integration Path

NexTurn is designed as a direct Customer-to-Customer layer beside Amazon's
commerce and returns experience. The important product rule is that no warehouse
is involved: the item stays with the seller until a buyer joins the queue and
pickup verification unlocks payment.

## Prototype Boundary

The prototype cannot connect to a real Amazon account, so it uses a hardcoded
Amazon order proof history in `src/data/c2cCommerce.js`. That seeded history is
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

1. **Seller proof**: signed-in seller selects an item from Amazon order
   history.
2. **Real item evidence**: seller uploads a current product photo.
3. **AI comparison**: Rekognition checks product identity, order-photo
   similarity, dominant colour/variant, and visible damage risk. NexTurn assigns
   a preliminary grade and resale value.
4. **Marketplace listing**: item is listed with "AI Graded & Amazon Verified"
   badge.
5. **No warehouse hold**: seller keeps the item at home.
6. **Buyer queue**: buyer sees order proof, original purchase date, preliminary
   AI comparison, seller location, and estimated delivery fee before joining the
   queue.
7. **Payment locked**: no payment is collected from the buyer yet.
8. **Facilitated delivery**: Amazon delivery partner verifies identity,
   colour/variant, and visible condition at seller pickup. Only then does the
   final payment step open.

## Production Adapter Flow

In production, the prototype order data becomes an adapter to Amazon order context:

1. Import order ID, ASIN, SKU, product image, purchase price, return eligibility,
   customer identity, and package contents.
2. Use S3 for seller upload media and Rekognition for visual evidence.
3. Persist customer profile, listing, grade, AI evidence, seller, and buyer
   queue records in DynamoDB.
4. Keep listing inventory with the seller until pickup verification.
5. Trigger Amazon local delivery after a buyer joins the queue and the seller is
   ready for pickup.
6. Let the delivery partner verify item quality at pickup against the order
   proof, uploaded evidence, and preliminary AI result before payment opens.

## Why This Is Customer-Centric

- Sellers recover value without mailing usable items to a warehouse first.
- Buyers get proof-backed second-hand items instead of anonymous listings.
- The platform clearly separates seller item value from Amazon's delivery fee,
  while delaying payment until pickup verification.
- Trust improves because the original purchase, current condition, and pickup
  verification are visible before checkout.
- Sustainability improves because unnecessary warehouse movement is avoided.

## Free Tier Fit

- HTTP API + Lambda for the API surface.
- DynamoDB on-demand for profiles, listings, and buyer queue records.
- S3 for uploaded scan media.
- Cognito Hosted UI for unified buyer/seller accounts and Google federation.
- Rekognition `DetectLabels` for practical AWS AI evidence.
