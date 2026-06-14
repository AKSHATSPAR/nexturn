#!/usr/bin/env node
import { App, CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from "aws-cdk-lib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
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

    table.addGlobalSecondaryIndex({
      indexName: "MarketplaceIndex",
      partitionKey: { name: "marketplaceStatus", type: AttributeType.STRING },
      sortKey: { name: "updatedAt", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
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
        NEX_TURN_MEDIA_BUCKET_NAME: siteBucket.bucketName,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });

    table.grantReadWriteData(apiHandler);
    siteBucket.grantWrite(apiHandler);
    apiHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      }),
    );

    const httpApi = new HttpApi(this, "NexTurnHttpApi", {
      apiName: "nexturn-return-resolution-api",
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
        allowOrigins: ["*"],
      },
    });

    const userPool = new cognito.UserPool(this, "CustomerUserPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const accountSuffix = (process.env.CDK_DEFAULT_ACCOUNT ?? "112920804206")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase();
    const authDomain = new cognito.UserPoolDomain(this, "CustomerAuthDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: process.env.NEXTURN_AUTH_DOMAIN_PREFIX ?? `nexturn-${accountSuffix}`,
      },
    });

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const supportedIdentityProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];
    let googleProvider;

    if (googleClientId && googleClientSecret) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(
        this,
        "GoogleIdentityProvider",
        {
          userPool,
          clientId: googleClientId,
          clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
          scopes: ["openid", "email", "profile"],
          attributeMapping: {
            email: cognito.ProviderAttribute.GOOGLE_EMAIL,
            fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          },
        },
      );
      supportedIdentityProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    const callbackUrls = [
      `${httpApi.apiEndpoint}/`,
      "http://127.0.0.1:5173/",
      "http://localhost:5173/",
    ];
    const userPoolClient = userPool.addClient("CustomerWebClient", {
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls: callbackUrls,
      },
    });

    if (googleProvider) {
      userPoolClient.node.addDependency(googleProvider);
    }

    const customerAuthorizer = new HttpUserPoolAuthorizer(
      "CustomerAuthorizer",
      userPool,
      {
        userPoolClients: [userPoolClient],
      },
    );

    const integration = new HttpLambdaIntegration("ReturnResolutionIntegration", apiHandler);
    httpApi.addRoutes({
      path: "/case",
      methods: [HttpMethod.GET],
      integration,
    });
    for (const pathName of ["/orders", "/resale", "/wallet", "/messages", "/impact"]) {
      httpApi.addRoutes({
        path: pathName,
        methods: [HttpMethod.GET],
        integration,
      });
    }
    httpApi.addRoutes({
      path: "/scan/evaluate",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/route",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/exchange/connect",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/me",
      methods: [HttpMethod.GET],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/c2c/orders",
      methods: [HttpMethod.GET],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/c2c/listings/evaluate",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/c2c/listings",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    httpApi.addRoutes({
      path: "/c2c/checkout",
      methods: [HttpMethod.POST],
      integration,
      authorizer: customerAuthorizer,
    });
    for (const pathName of ["/c2c/marketplace", "/c2c/listing"]) {
      httpApi.addRoutes({
        path: pathName,
        methods: [HttpMethod.GET],
        integration,
      });
    }

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
      environment: {
        NEX_TURN_AUTH_ENABLED: "true",
        NEX_TURN_AUTH_CLIENT_ID: userPoolClient.userPoolClientId,
        NEX_TURN_AUTH_DOMAIN: authDomain.baseUrl(),
        NEX_TURN_AUTH_REDIRECT_URI: `${httpApi.apiEndpoint}/`,
        NEX_TURN_AUTH_LOGOUT_URI: `${httpApi.apiEndpoint}/`,
        NEX_TURN_AUTH_GOOGLE_ENABLED: googleProvider ? "true" : "false",
      },
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

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "SiteUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "AuthDomain", { value: authDomain.baseUrl() });
    new CfnOutput(this, "GoogleSignInEnabled", { value: googleProvider ? "true" : "false" });
  }
}

const app = new App();
new NexTurnStack(app, "NexTurnStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
