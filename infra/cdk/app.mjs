#!/usr/bin/env node
import { App, CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";

const cdkDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(cdkDir, "../..");

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

    const apiHandler = new NodejsFunction(this, "ReturnResolutionHandler", {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      entry: path.join(rootDir, "backend/lambda/returnResolution.js"),
      handler: "handler",
      depsLockFilePath: path.join(rootDir, "package-lock.json"),
      bundling: {
        minify: true,
        sourceMap: true,
      },
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

    const siteHandler = new NodejsFunction(this, "SiteHandler", {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      entry: path.join(rootDir, "backend/lambda/siteServer.js"),
      handler: "handler",
      depsLockFilePath: path.join(rootDir, "package-lock.json"),
      bundling: {
        minify: true,
        sourceMap: true,
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling(inputDir, outputDir) {
            return [`cp -R "${path.join(inputDir, "dist")}" "${path.join(outputDir, "dist")}"`];
          },
        },
      },
      timeout: Duration.seconds(8),
      memorySize: 256,
    });

    const siteIntegration = new HttpLambdaIntegration("SiteIntegration", siteHandler);
    httpApi.addRoutes({
      path: "/",
      methods: [HttpMethod.GET],
      integration: siteIntegration,
    });
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [HttpMethod.GET],
      integration: siteIntegration,
    });

    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "SiteUrl", { value: httpApi.apiEndpoint });
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
