# AWS Infrastructure

NexTurn uses AWS where it adds real value to the prototype:

- **DynamoDB** for return cases, route decisions, buyer matches, trust passports,
  and green-credit ledger entries.
- **Lambda** for the return-resolution API.
- **HTTP API Gateway** for low-cost API exposure.
- **S3** as the static web build artifact target.
- **CloudWatch** through Lambda/API Gateway defaults for logs and metrics.

The stack is configured for `us-east-1` and on-demand/free-tier-friendly usage.

## Commands

```bash
npm run cdk:synth
npm run cdk:deploy
```

The current handler works without deployed data by falling back to deterministic
seeded demo data. The DynamoDB table is provisioned so the repository has a real
AWS persistence boundary ready for the next iteration.
