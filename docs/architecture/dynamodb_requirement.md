# DynamoDB Modeling Session

## Application Overview

- **Domain**: customer returns, certified resale, exchange, donation, and recycling.
- **Key Entities**: Customer, ConnectedOrder, ReturnCase, ReturnScan, RouteDecision,
  TrustPassport, BuyerMatch, GreenCreditLedger, RefurbishedAlternative.
- **Business Context**: a customer starts from an order return and needs a fast,
  trusted, explainable next action. Amazon-style order integration is represented
  by an adapter boundary so SP-API credentials can be added without changing the
  domain model.
- **Scale**: prototype values below are explicit hackathon estimates for a
  free-tier demo. Production scale can raise RPS without changing the aggregate
  boundaries.

## Access Patterns Analysis

| Pattern # | Description | RPS (Peak / Average) | Type | Attributes Needed | Key Requirements | Design Considerations | Status |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| AP1 | Get a return case with order, item, scan, selected route, and passport | 20 / 2 | Read | returnId, customerId, orderId, scan signals, passport | <80ms p95 | Item collection by `RETURN#<id>` keeps case data together | Complete |
| AP2 | List a customer's recent returns | 15 / 1 | Read | customerId, updatedAt, item title, status, selected route | Paginated | Sparse customer GSI projects summary fields | Complete |
| AP3 | Create or update a return scan | 10 / 1 | Write | returnId, scan signals, uploaded asset keys, grade | Idempotent | Write scan item under return collection | Complete |
| AP4 | Lock a customer's selected route | 8 / 1 | Write | returnId, routeId, credits, payout, passport status | Conditional update | Update route decision and passport atomically in app layer | Complete |
| AP5 | Query operations queue by route/status | 10 / 1 | Read | routeStatus, updatedAt, returnId, grade | Bounded queue page | Sparse route-status GSI avoids scanning returns | Complete |
| AP6 | Get buyer matches for a return | 20 / 2 | Read | returnId, buyerId, offer, credits, match reason | <100ms p95 | Buyer matches share the return partition | Complete |
| AP7 | Append green credit ledger event | 8 / 1 | Write | customerId, eventId, amount, reason, createdAt | Auditable | Separate customer partition avoids rewriting customer profile | Complete |
| AP8 | List green credit activity | 8 / 1 | Read | customerId, createdAt, amount, reason | Paginated | Customer GSI supports wallet history | Complete |

## Entity Relationships Deep Dive

- **Customer -> ReturnCase**: 1:Many. Returns are usually shown by customer and
  by individual case.
- **ReturnCase -> Scan / Routes / Passport / BuyerMatches**: identifying
  relationship. These records do not exist without the parent return.
- **Customer -> GreenCreditLedger**: 1:Many. Ledger entries are append-only and
  queried from the wallet.
- **ReturnCase -> BuyerMatches**: 1:Many, bounded page for demo and queue use.

## Aggregate Analysis

### ReturnCase Item Collection

- **Access Correlation**: >80% of return-resolution reads need case, scan,
  route, passport, and buyer matches together.
- **Size Constraints**: bounded; images/videos are stored in S3 and referenced
  by key, keeping DynamoDB items small.
- **Update Patterns**: scan and route updates happen independently but under the
  same return context.
- **Decision**: item collection with `pk = RETURN#<returnId>`.
- **Justification**: one query can hydrate the customer flow without joins.

### Customer + Returns

- **Access Correlation**: around 35-45%; users often list recent returns before
  opening a case.
- **Decision**: keep returns as their own aggregate and project summaries into a
  customer GSI.
- **Justification**: avoids hot customer partitions with large histories while
  still serving customer lists efficiently.

## Validation Checklist

- [x] Application domain and scale documented.
- [x] Entities and relationships mapped.
- [x] Access patterns include explicit prototype RPS estimates.
- [x] Write pattern exists for every read pattern that mutates state.
- [x] Hot partition risks evaluated.
- [x] No scan-based access pattern required.
