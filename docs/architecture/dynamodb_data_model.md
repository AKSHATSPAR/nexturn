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

- **Purpose**: stores return resolution aggregates and green-credit ledger
  entries.
- **Partition Key**: `pk`, a composite string because base tables do not support
  multi-attribute keys.
- **Sort Key**: `sk`, a typed prefix key for bounded range queries.
- **SK Taxonomy**: `META`, `SCAN#<version>`, `ROUTE#<routeId>`,
  `PASSPORT#<passportId>`, `MATCH#<buyerId>`, `CREDIT#<createdAt>#<eventId>`.
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

## Hot Partition Analysis

- Return case reads are distributed by `returnId`; prototype peak is far below
  the 3,000 RCU per-partition limit.
- Customer wallet reads are distributed by `customerId`; a single high-activity
  customer remains below prototype limits.
- `routeStatus` can become skewed in production. If `resell#READY` becomes hot,
  shard the route status as `resell#READY#<0-9>` and query shards in parallel.

## Trade-offs

- **Item collection for return cases** improves customer screen latency and keeps
  the prototype simple.
- **Sparse route queue index** avoids scanning returns for operations views.
- **Media in S3** keeps DynamoDB item sizes small and predictable.
- **On-demand billing** keeps the free-tier prototype safer than over-tuned
  provisioned capacity.
