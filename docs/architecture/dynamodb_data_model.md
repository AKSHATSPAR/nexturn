# DynamoDB Data Model

## Design Philosophy

NexTurn uses a focused item-collection model around the return case. A return
resolution screen needs the order context, item scan, route options, buyer
matches, and trust passport together. Keeping those records under one partition
lets the app hydrate the customer flow with a single bounded query.

The model does not store photos or videos directly in DynamoDB. S3 owns media;
DynamoDB stores keys, derived scan signals, and customer-facing decisions.

## Table Design

### NexTurnTable

| pk | sk | entityType | customerId | routeStatus | updatedAt |
| --- | --- | --- | --- | --- | --- |
| `RETURN#ret_8821_7710_55` | `META` | `ReturnCase` | `cust_aarav` | `resell#READY` | `2026-06-13T18:15:00Z` |
| `RETURN#ret_8821_7710_55` | `SCAN#latest` | `ReturnScan` | `cust_aarav` |  | `2026-06-13T18:15:00Z` |
| `RETURN#ret_8821_7710_55` | `ROUTE#resell` | `RouteDecision` | `cust_aarav` | `resell#READY` | `2026-06-13T18:15:00Z` |
| `RETURN#ret_8821_7710_55` | `PASSPORT#NT-8821-7710-55` | `TrustPassport` | `cust_aarav` |  | `2026-06-13T18:15:00Z` |
| `RETURN#ret_8821_7710_55` | `MATCH#buyer_rahul` | `BuyerMatch` | `cust_aarav` |  | `2026-06-13T18:15:00Z` |
| `CUSTOMER#cust_aarav` | `CREDIT#2026-06-13T18:15:00Z#evt_1` | `GreenCreditLedger` | `cust_aarav` |  | `2026-06-13T18:15:00Z` |
| `CUSTOMER#cust_aarav` | `FIT#alt_qc` | `PurchaseFitRecommendation` | `cust_aarav` |  | `2026-06-13T18:15:00Z` |
| `CUSTOMER#cust_aarav` | `PROFILE` | `CustomerProfile` | `cust_aarav` |  | `2026-06-14T11:00:00Z` |
| `LISTING#nt_112741...` | `INTEREST#interest_1` | `C2CBuyerInterest` | `cust_buyer` |  | `2026-06-14T11:08:00Z` |

- **Purpose**: stores return resolution aggregates and green-credit ledger
  entries.
- **Partition Key**: `pk`, a composite string because base tables do not support
  multi-attribute keys.
- **Sort Key**: `sk`, a typed prefix key for bounded range queries.
- **SK Taxonomy**: `META`, `PROFILE`, `SCAN#<version>`, `ROUTE#<routeId>`,
  `PASSPORT#<passportId>`, `MATCH#<buyerId>`, `CREDIT#<createdAt>#<eventId>`,
  `FIT#<alternativeId>`, `INTEREST#<interestId>`.
- **Capacity**: on-demand billing for the prototype; no provisioned capacity to
  tune during the hackathon.

## GSIs

### CustomerActivityIndex

| customerId | updatedAt | pk | sk | entityType | routeStatus |
| --- | --- | --- | --- | --- | --- |
| `cust_aarav` | `2026-06-13T18:15:00Z` | `RETURN#ret_8821_7710_55` | `META` | `ReturnCase` | `resell#READY` |
| `cust_aarav` | `2026-06-13T18:15:00Z` | `CUSTOMER#cust_aarav` | `CREDIT#2026-06-13T18:15:00Z#evt_1` | `GreenCreditLedger` |  |

- **Purpose**: list customer returns and wallet activity.
- **Partition Key**: `customerId`.
- **Sort Key**: `updatedAt`.
- **Projection**: include summary attributes needed by customer lists.
- **Sparse**: only items with `customerId` and `updatedAt` appear.

### RouteQueueIndex

| routeStatus | updatedAt | pk | sk | entityType | customerId |
| --- | --- | --- | --- | --- | --- |
| `resell#READY` | `2026-06-13T18:15:00Z` | `RETURN#ret_8821_7710_55` | `META` | `ReturnCase` | `cust_aarav` |
| `resell#READY` | `2026-06-13T18:15:00Z` | `RETURN#ret_8821_7710_55` | `ROUTE#resell` | `RouteDecision` | `cust_aarav` |

- **Purpose**: operations/seller queue for items ready to resell, exchange,
  donate, or recycle.
- **Partition Key**: `routeStatus`.
- **Sort Key**: `updatedAt`.
- **Projection**: include route, grade, value, and customer summary fields.
- **Sparse**: only routable items include `routeStatus`.

### MarketplaceIndex

| marketplaceStatus | updatedAt | pk | sk | entityType | listingId |
| --- | --- | --- | --- | --- | --- |
| `LISTING#ACTIVE` | `2026-06-14T10:00:00Z` | `LISTING#nt_112741...` | `PROFILE` | `C2CListing` | `nt_112741...` |
| `LISTING#SOLD` | `2026-06-14T10:08:00Z` | `LISTING#nt_112741...` | `PROFILE` | `C2CListing` | `nt_112741...` |

- **Purpose**: list active direct C2C marketplace inventory without scanning.
- **Partition Key**: `marketplaceStatus`.
- **Sort Key**: `updatedAt`.
- **Projection**: all attributes, because listing cards and detail drawers need
  grade, AI review, proof metadata, seller, price, queue count, and logistics
  text.
- **Sparse**: only C2C listing and buyer-interest records include marketplace
  status.

## Access Pattern Mapping

| Pattern # | Description | Type | Peak RPS | Items Returned | Avg Item Size | Table/GSI Used | DynamoDB Operation | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| AP1 | Get return case screen | Query | 20 | 8 | 2 KB | NexTurnTable | `Query(pk = RETURN#id)` | Bounded item collection |
| AP2 | List customer returns | Query | 15 | 10 | 1 KB | CustomerActivityIndex | `Query(customerId = id)` | Paginated by `updatedAt` |
| AP3 | Create/update scan | PutItem | 10 | - | 2 KB | NexTurnTable | `PutItem(pk, sk = SCAN#latest)` | Idempotent latest scan |
| AP4 | Lock route | UpdateItem | 8 | - | 1 KB | NexTurnTable | `UpdateItem(pk, sk = ROUTE#id)` | Conditional route support |
| AP5 | Queue by route/status | Query | 10 | 25 | 1 KB | RouteQueueIndex | `Query(routeStatus = route#status)` | No scan required |
| AP6 | Get buyer matches | Query | 20 | 4 | 1 KB | NexTurnTable | `Query(pk = RETURN#id, begins_with(sk, MATCH#))` | Bounded match list |
| AP7 | Append green credit event | PutItem | 8 | - | 1 KB | NexTurnTable | `PutItem(pk = CUSTOMER#id, sk = CREDIT#...)` | Append-only ledger |
| AP8 | List green credit activity | Query | 8 | 20 | 1 KB | CustomerActivityIndex | `Query(customerId = id)` | Filter by entity type in app |
| AP9 | List low-return purchase alternatives | Query | 10 | 6 | 1 KB | NexTurnTable | `Query(pk = CUSTOMER#id, begins_with(sk, FIT#))` | Supports predictive return prevention |
| AP10 | List active C2C marketplace listings | Query | 30 | 50 | 3 KB | MarketplaceIndex | `Query(marketplaceStatus = LISTING#ACTIVE)` | Hero listings above public API feed |
| AP11 | Create C2C listing | PutItem | 8 | - | 4 KB | NexTurnTable | `PutItem(pk = LISTING#id, sk = PROFILE)` | Seller keeps item at home |
| AP12 | Join C2C buyer queue | TransactWrite | 8 | - | 2 KB | NexTurnTable | `Put interest + atomically mark listing queueFilled` | First buyer reserves queue; payment locked until pickup review |
| AP13 | Get listing detail | GetItem | 25 | 1 | 4 KB | NexTurnTable | `GetItem(pk = LISTING#id, sk = PROFILE)` | Proof, AI review, price, purchase date, logistics |
| AP14 | Save buyer/seller profile | PutItem | 8 | - | 1 KB | NexTurnTable | `PutItem(pk = CUSTOMER#id, sk = PROFILE)` | Required India address before buy/sell |

## Hot Partition Analysis

- Return case reads are distributed by `returnId`; prototype peak is far below
  the 3,000 RCU per-partition limit.
- Customer wallet reads are distributed by `customerId`; a single high-activity
  customer remains below prototype limits.
- `routeStatus` can become skewed in production. If `resell#READY` becomes hot,
  shard the route status as `resell#READY#<0-9>` and query shards in parallel.
- `LISTING#ACTIVE` can become hot in a production marketplace. The next step is
  category or locality sharding such as `LISTING#ACTIVE#audio#blr`.

## Trade-offs

- **Item collection for return cases** improves customer screen latency and keeps
  the prototype simple.
- **Sparse route queue index** avoids scanning returns for operations views.
- **Media in S3** keeps DynamoDB item sizes small and predictable.
- **On-demand billing** keeps the free-tier prototype safer than over-tuned
  provisioned capacity.
- **MarketplaceIndex** makes active C2C inventory visible to every signed-in
  buyer while preserving the no-warehouse rule in the listing record itself.
