# AWS Infrastructure

NexTurn uses AWS where it adds real value to the prototype:

- **DynamoDB** for return cases, route decisions, buyer matches, trust passports,
  and green-credit ledger entries.
- **Lambda** for the return-resolution API.
- **HTTP API Gateway** for low-cost API exposure.
- **S3** as a private return-scan media bucket.
- **Amazon Cognito** for Hosted UI customer auth and JWT-protected write routes.
- **Amazon Rekognition** for uploaded image label detection.
- **CloudWatch** through Lambda/API Gateway defaults for logs and metrics.

The stack is configured for `us-east-1` and on-demand/free-tier-friendly usage.

## Commands

```bash
npm run cdk:synth
npm run cdk:deploy
```

Both commands build the React app first because the stack bundles `dist/` into a
small static-site Lambda served through the same HTTP API as the backend routes.
The backend Lambda receives the S3 bucket name through
`NEX_TURN_MEDIA_BUCKET_NAME` and has scoped write access plus
`rekognition:DetectLabels`.

Write routes are protected by the Cognito JWT authorizer:

- `POST /scan/evaluate`
- `POST /route`
- `POST /exchange/connect`
- `GET /me`

Read-only demo routes remain public so judges can inspect the app before signing
in.

Optional Google federation is enabled by setting these variables before deploy:

```bash
GOOGLE_CLIENT_ID=<google-oauth-client-id> \
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret> \
npm run cdk:deploy
```

After deployment, seed the demo data with the DynamoDB table name emitted by the
stack:

```bash
NEX_TURN_TABLE_NAME=<table-name> npm run seed:ddb
```

The current handler works without deployed data by falling back to deterministic
seeded demo data. On AWS, route locks and scan evaluations persist to DynamoDB,
and uploaded return photos are stored in S3 before Rekognition analysis.
