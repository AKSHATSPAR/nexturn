# NexTurn Solution Draft

## Problem Statement & Relevance

Millions of online purchases are returned even when the products are still
usable. Customers lose time, wait for refunds, and rarely know whether their
item will be resold, refurbished, donated, recycled, or discarded. Second-hand
buyers also hesitate because condition and authenticity are hard to trust.

NexTurn solves the customer-facing uncertainty around returns. It turns a return
into an explainable resolution flow where customers can compare value,
convenience, trust, and sustainability before choosing the next step.

## What Makes This Novel

Most resale ideas start after an item is already listed. NexTurn starts at the
return moment. It combines return scan signals, route ranking, buyer demand,
green credits, and a Trust Passport in one customer decision surface.

The unique angle is not just "AI resale"; it is **return resolution as a trusted
customer choice**.

## Target Customer

The primary customer is an online shopper returning a usable product who wants
a fast refund or exchange but also wants confidence that the item gets a
meaningful second life.

## Solution

NexTurn provides:

- AI-style condition grading from scan signals;
- next-best-action comparison across resell, exchange, donate, and recycle;
- trusted buyer matches and refurbished alternatives;
- green-credit incentives;
- a Trust Passport that records authenticity, function test, cleaning, and route
  lock status.

## Working Prototype

Implemented:

- React return-resolution dashboard.
- Interactive route selection that updates Trust Passport and green-credit
  preview.
- Deterministic decision engine with explainable scoring.
- Lambda-compatible backend API.
- DynamoDB persistence adapter and CDK infrastructure.

Demo evidence:

- Concept: `docs/design/return-resolution-studio-concept.png`
- Screenshot: `docs/screenshots/nexturn-desktop-tight.png`
- Local app: `http://127.0.0.1:5173/`

## Tech Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Frontend | React + Vite | Fast, interactive prototype with production-style component structure |
| Backend | AWS Lambda + HTTP API | Low-cost serverless API for return decisions |
| Data | DynamoDB | Low-latency item collections for return case workflows |
| Infra | AWS CDK | Repeatable deployment in `us-east-1` |
| Assets | HTTP API static-site Lambda + S3-ready media bucket | Live AWS demo without CloudFront account verification |

## Key Algorithms

### Condition Grade

The grade combines product identity, original-order image similarity,
colour/variant match, visible damage risk, and fraud risk. The result is
explainable and repeatable, and remains preliminary until pickup verification.

### Route Ranking

Routes are ranked by demand, condition, payout, convenience, and sustainability
signals. For a high-grade item with strong buyer demand, resale is recommended.
For low-trust or damaged items, recycling or manual review can win.

### Trust Passport

The passport records authenticity, function test, cleaning, route lock, and
certificate ID. This helps the next buyer trust the second-life product.

## Scalability

- DynamoDB partitions by return ID and customer ID for high-cardinality access.
- Route queues use a sparse GSI and can be sharded if one route status becomes
  hot.
- Lambda scales horizontally with API traffic.
- Media is kept in S3, not DynamoDB, to avoid large item sizes.
- The Amazon integration is behind an adapter boundary so real SP-API order and
  return data can replace seeded data later.

## Future Vision

In 3-6 months, NexTurn can connect to real order/return events, S3 media upload,
and Rekognition image signals. In 6-12 months, it can power certified resale,
seller operations queues, and personalized second-life recommendations at
marketplace scale.

## Links

- GitHub: `https://github.com/AKSHATSPAR/nexturn`
- Live app: `https://l5f3ovamaj.execute-api.us-east-1.amazonaws.com`
- Demo video: pending recording
