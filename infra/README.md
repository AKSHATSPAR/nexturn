# AWS Infrastructure

NexTurn uses AWS where it adds real value to the prototype:

- **DynamoDB** for return cases, route decisions, buyer matches, trust passports,
  and green-credit ledger entries.
- **Lambda** for the return-resolution API.
- **HTTP API Gateway** for low-cost API exposure.
- **S3** as a private return-scan media bucket.
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

After deployment, seed the demo data with the DynamoDB table name emitted by the
stack:

```bash
NEX_TURN_TABLE_NAME=<table-name> npm run seed:ddb
```

The current handler works without deployed data by falling back to deterministic
seeded demo data. On AWS, route locks and scan evaluations persist to DynamoDB,
and uploaded return photos are stored in S3 before Rekognition analysis.
