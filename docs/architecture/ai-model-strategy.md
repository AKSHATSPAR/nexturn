# AI Model Strategy

## Current Prototype

NexTurn does not train a custom machine-learning model in this prototype. That
is intentional for a one-week contest: a trustworthy returns model would need
large, labeled image/video datasets across categories, brands, defect types,
fraud patterns, refurb outcomes, resale prices, and post-resale customer
feedback.

Instead, the current build uses an explainable decision engine that behaves like
the customer-facing policy layer of an AI system:

- scan signals: cosmetic wear, function score, accessories, hygiene, packaging,
  demand, price retention, and fraud risk;
- condition grade: weighted scoring with confidence and reason text;
- route ranking: resell, exchange, donate, and recycle compared by value,
  convenience, sustainability, demand, and risk;
- purchase-fit ranking: refurbished alternatives ranked by customer preference
  and predicted return risk.

This makes the demo deterministic, testable, and safe for judges to repeat.

## AWS AI Path

The production path is to feed the same engine with AWS AI-derived signals:

1. Store uploaded return images/videos in S3.
2. Use image/video analysis to detect visible product condition, missing
   accessories, packaging state, and label mismatch.
3. Use Bedrock-style summarization for customer-readable explanations, while
   keeping final route scoring deterministic and auditable.
4. Persist extracted signals, grade, route decision, Trust Passport, and green
   credit events in DynamoDB.

## Why Not Train From Scratch Now

Training a real model in one week would risk overfitting to a tiny toy dataset
and make the product less credible. A better hackathon-grade implementation is:

- working customer journey now;
- AWS-ready AI signal adapter boundary;
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
