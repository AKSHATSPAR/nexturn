# System Architecture

## Runtime Flow

```mermaid
sequenceDiagram
  actor Customer
  participant App as React App
  participant API as HTTP API Gateway
  participant Lambda as Return Resolution Lambda
  participant Engine as Decision Engine
  participant DDB as DynamoDB

  Customer->>App: Opens connected return
  App->>API: GET /case
  API->>Lambda: Invoke handler
  Lambda->>Engine: Grade item and rank routes
  Lambda-->>App: Case + decision + matches
  Customer->>App: Selects route
  App->>API: POST /route
  API->>Lambda: Invoke handler
  Lambda->>DDB: Persist route, passport, credit event
  Lambda-->>App: Route lock + credit preview
```

## AWS Services

| Service | Use | Why it fits |
| --- | --- | --- |
| DynamoDB | Return cases, scans, route decisions, passports, credit events | Low-latency serverless data model with on-demand capacity |
| Lambda | Decision API | Small event-driven workload, free-tier-friendly |
| HTTP API Gateway | API surface | Cheaper and simpler than REST API for prototype routes |
| S3 | Static build artifact target and future media storage | Durable, low-cost object storage |
| CloudWatch | Logs and metrics | Built-in operational visibility |

## Customer-Centric Decision Model

NexTurn does not simply maximize resale revenue. It compares:

- customer payout;
- time to resolution;
- convenience;
- item condition and confidence;
- second-life demand;
- green credits and sustainability impact.

For the seeded scenario, resale wins because the item has high condition,
complete accessories, strong demand, and a trusted buyer match.
