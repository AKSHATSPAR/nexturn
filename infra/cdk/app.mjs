#!/usr/bin/env node
import { App, CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Architecture, Code, Runtime, Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";

class NexTurnStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    const table = new Table(this, "NexTurnTable", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      timeToLiveAttribute: "expiresAt",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: "CustomerActivityIndex",
      partitionKey: { name: "customerId", type: AttributeType.STRING },
      sortKey: { name: "updatedAt", type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: [
        "entityType",
        "returnId",
        "itemTitle",
        "status",
        "routeStatus",
        "creditAmount",
      ],
    });

    table.addGlobalSecondaryIndex({
      indexName: "RouteQueueIndex",
      partitionKey: { name: "routeStatus", type: AttributeType.STRING },
      sortKey: { name: "updatedAt", type: AttributeType.STRING },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: [
        "entityType",
        "returnId",
        "customerId",
        "grade",
        "payout",
        "greenCredits",
      ],
    });

    const apiHandler = new LambdaFunction(this, "ReturnResolutionHandler", {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      handler: "backend/lambda/returnResolution.handler",
      code: Code.fromAsset(".", {
        exclude: [
          ".git",
          ".npm-cache",
          "cdk.out",
          "dist",
          "docs/screenshots",
          "infra/cdk/node_modules",
          "node_modules/.cache",
        ],
      }),
      timeout: Duration.seconds(8),
      memorySize: 256,
      environment: {
        NEX_TURN_TABLE_NAME: table.tableName,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });

    table.grantReadWriteData(apiHandler);

    const httpApi = new HttpApi(this, "NexTurnHttpApi", {
      apiName: "nexturn-return-resolution-api",
      corsPreflight: {
        allowHeaders: ["content-type"],
        allowMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
        allowOrigins: ["*"],
      },
    });

    const integration = new HttpLambdaIntegration("ReturnResolutionIntegration", apiHandler);
    httpApi.addRoutes({
      path: "/case",
      methods: [HttpMethod.GET],
      integration,
    });
    httpApi.addRoutes({
      path: "/scan/evaluate",
      methods: [HttpMethod.POST],
      integration,
    });
    httpApi.addRoutes({
      path: "/route",
      methods: [HttpMethod.POST],
      integration,
    });

    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
  }
}

const app = new App();
new NexTurnStack(app, "NexTurnStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
