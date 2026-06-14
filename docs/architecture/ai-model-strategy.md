# AI Model Strategy

## Current Prototype

NexTurn does not train a custom machine-learning model in this prototype. That
is intentional for a two-to-three-week contest: a trustworthy returns model would need
large, labeled image/video datasets across categories, brands, defect types,
fraud patterns, refurb outcomes, resale prices, and post-resale customer
feedback.

Instead, the current build uses AWS AI where it is practical and keeps the final
customer decision explainable:

- uploaded return photos are posted to `POST /scan/evaluate`;
- C2C seller listing photos are posted to `POST /c2c/listings/evaluate` or
  `POST /c2c/listings`;
- the Lambda stores the image in a private S3 bucket when deployed;
- Amazon Rekognition `DetectLabels` analyzes the uploaded image;
- returned labels are filtered against the expected item category and shown as
  matched or ignored AI evidence;
- the condition grade, resale discount, and checkout rules remain deterministic
  so customer-facing decisions are auditable.

The decision engine behaves like the customer-facing policy layer of an AI
system:

- scan signals: cosmetic wear, function score, accessories, hygiene, packaging,
  demand, price retention, and fraud risk;
- condition grade: weighted scoring with confidence and reason text;
- route ranking: resell, exchange, donate, and recycle compared by value,
  convenience, sustainability, demand, and risk;
- C2C listing scorecard: functional, cosmetic, packaging, accessory, identity,
  and damage signals;
- purchase-fit ranking: refurbished alternatives ranked by customer preference
  and predicted return risk.

The visible condition chips in the seller UI are seller-declared hints, not the
source of truth. They help the prototype express obvious packaging/wear cases,
but they cannot override the AI identity gate. If the uploaded photo looks like
a phone while the selected order is AirPods Max, NexTurn blocks listing.

This makes the demo deterministic, testable, and safe for judges to repeat.

## AWS AI Path Implemented

The implemented path already feeds the same engine with AWS AI-derived signals:

1. Store uploaded return images in S3.
2. Use Rekognition image analysis to detect product/category/scene labels.
3. Compare labels with the expected returned item category. Relevant labels add
   identity/accessory context; unrelated labels are shown as ignored evidence.
4. For C2C, compare upload evidence against the selected fake Amazon order
   metadata and, when possible, the original order image labels.
5. If uploaded evidence does not match the expected item, lower identity score
   and route the listing toward manual review.
6. If the selected condition or evidence includes broken/cracked screen signals,
   force a low grade such as `C`.
7. Persist extracted signals, grade, listing, media metadata, and checkout
   records in DynamoDB.

## How The Grade Is Decided

Rekognition does not decide that an item is A-, B+, or C. The grade comes from a
weighted scorecard.

For the original return-resolution flow:

- functional score;
- cosmetic wear;
- accessory completeness;
- hygiene score;
- packaging score;
- fraud-risk signal;
- resale demand.

For the direct C2C marketplace:

- functional score;
- cosmetic score;
- packaging score;
- accessory completeness;
- identity score from order/photo match;
- damage flags such as `broken_screen`;
- grade-specific price retention.

This is why an uploaded image of the wrong product should no longer look like a
fake successful A- scan. The label mismatch is reflected in the UI, persisted as
AI evidence, and used to increase the fraud-risk input before the scorecard runs.

This is also why a broken phone screen does not stay highly graded. The C2C
scorecard clamps functional and cosmetic scores when broken-screen evidence is
declared or detected, producing a low grade and a steep discount.

The matching logic intentionally ignores broad labels such as `Electronics` or
`Device` for identity. A generic electronics label is not enough proof that the
uploaded product is the same item from the selected order.

## Why Keep the Rule Layer

Rekognition is useful for visual evidence, but it should not independently
decide a customer's payout or sustainability reward. NexTurn keeps the final
route scoring deterministic because customers and sellers need repeatable
reasons for grade, payout, exchange, donation, and recycling choices.

Later iterations can add Bedrock-style summarization for customer-readable
explanations while keeping final route scoring deterministic and auditable.

## Why Not Train From Scratch Now

Training a real model during a short hackathon would risk overfitting to a tiny
toy dataset and make the product less credible. A better hackathon-grade
implementation is:

- working customer journey now;
- actual AWS AI calls for uploaded images;
- transparent scoring and tests;
- future training plan once real labeled return outcomes exist.

## Future Training Plan

Once real data exists, NexTurn can train specialized models for:

- defect detection by category;
- resale price prediction;
- return-risk prediction before purchase;
- fraud/anomaly detection for suspicious returns;
- buyer-match conversion probability.

The trained models should not replace the route policy layer. They should feed
it with better signals so the customer still gets an explainable decision.
