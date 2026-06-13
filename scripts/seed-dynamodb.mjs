import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  buyerMatches,
  refurbishedAlternatives,
  returnCase,
} from "../src/data/returnCase.js";
import { summarizeDecision } from "../src/lib/decisionEngine.js";
import { rankPurchaseFit } from "../src/lib/purchaseFit.js";

const tableName = process.env.NEX_TURN_TABLE_NAME;

if (!tableName) {
  throw new Error("Set NEX_TURN_TABLE_NAME before running npm run seed:ddb");
}

const now = new Date().toISOString();
const decision = summarizeDecision(returnCase);
const rankedAlternatives = rankPurchaseFit(refurbishedAlternatives, returnCase.customer);
const returnPk = `RETURN#${returnCase.id}`;
const customerPk = `CUSTOMER#${returnCase.customer.id}`;

const baseItems = [
  {
    pk: returnPk,
    sk: "META",
    entityType: "ReturnCase",
    returnId: returnCase.id,
    customerId: returnCase.customer.id,
    customerName: returnCase.customer.name,
    itemTitle: returnCase.item.title,
    itemSku: returnCase.item.sku,
    status: returnCase.status,
    grade: decision.grade.grade,
    gradeScore: decision.grade.score,
    recommendedRoute: decision.recommended.id,
    routeStatus: `${decision.recommended.id}#READY`,
    originalPrice: returnCase.item.originalPrice,
    updatedAt: now,
  },
  {
    pk: returnPk,
    sk: "SCAN#latest",
    entityType: "ReturnScan",
    returnId: returnCase.id,
    customerId: returnCase.customer.id,
    scan: returnCase.scan,
    grade: decision.grade.grade,
    gradeScore: decision.grade.score,
    recommendedRoute: decision.recommended.id,
    updatedAt: now,
  },
  {
    pk: returnPk,
    sk: `ROUTE#${decision.recommended.id}`,
    entityType: "RouteDecision",
    returnId: returnCase.id,
    customerId: returnCase.customer.id,
    routeStatus: `${decision.recommended.id}#READY`,
    routeId: decision.recommended.id,
    routeTitle: decision.recommended.title,
    payout: decision.recommended.payout,
    greenCredits: decision.recommended.greenCredits,
    score: decision.recommended.score,
    updatedAt: now,
  },
  {
    pk: returnPk,
    sk: `PASSPORT#${returnCase.trustPassport.id}`,
    entityType: "TrustPassport",
    returnId: returnCase.id,
    customerId: returnCase.customer.id,
    ...returnCase.trustPassport,
    lockedRoute: decision.recommended.shortLabel,
    status: "ready_for_customer_confirmation",
    updatedAt: now,
  },
];

const matchItems = buyerMatches.map((match) => ({
  pk: returnPk,
  sk: `MATCH#${match.id}`,
  entityType: "BuyerMatch",
  returnId: returnCase.id,
  customerId: returnCase.customer.id,
  ...match,
  updatedAt: now,
}));

const fitItems = rankedAlternatives.map((item) => ({
  pk: customerPk,
  sk: `FIT#${item.id}`,
  entityType: "PurchaseFitRecommendation",
  customerId: returnCase.customer.id,
  returnId: returnCase.id,
  itemId: item.id,
  itemName: item.name,
  image: item.image,
  price: item.price,
  condition: item.condition,
  label: item.label,
  confidence: item.confidence,
  returnRisk: item.returnRisk,
  recommendation: item.recommendation,
  updatedAt: now,
}));

const creditPreviewItem = {
  pk: customerPk,
  sk: `CREDIT#${now}#preview_${decision.recommended.id}`,
  entityType: "GreenCreditLedger",
  customerId: returnCase.customer.id,
  returnId: returnCase.id,
  creditAmount: decision.recommended.greenCredits,
  reason: `${decision.recommended.title} preview`,
  updatedAt: now,
};

const items = [...baseItems, ...matchItems, ...fitItems, creditPreviewItem];
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

for (let index = 0; index < items.length; index += 25) {
  const chunk = items.slice(index, index + 25);
  await client.send(
    new BatchWriteCommand({
      RequestItems: {
        [tableName]: chunk.map((Item) => ({
          PutRequest: { Item },
        })),
      },
    }),
  );
}

console.log(`Seeded ${items.length} NexTurn records into ${tableName}`);
