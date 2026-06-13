const tableName = process.env.NEX_TURN_TABLE_NAME;

let documentClientPromise;

async function getDocumentClient() {
  if (!tableName) return null;
  if (!documentClientPromise) {
    documentClientPromise = Promise.all([
      import("@aws-sdk/client-dynamodb"),
      import("@aws-sdk/lib-dynamodb"),
    ]).then(([dynamodb, lib]) =>
      lib.DynamoDBDocumentClient.from(new dynamodb.DynamoDBClient({}), {
        marshallOptions: {
          removeUndefinedValues: true,
        },
      }),
    );
  }
  return documentClientPromise;
}

export async function saveScanEvaluation(returnCase, grade, recommendedRoute) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false };
  }

  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const now = new Date().toISOString();

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `RETURN#${returnCase.id}`,
        sk: "SCAN#latest",
        entityType: "ReturnScan",
        returnId: returnCase.id,
        customerId: returnCase.customer.id,
        itemTitle: returnCase.item.title,
        grade: grade.grade,
        gradeScore: grade.score,
        recommendedRoute: recommendedRoute.id,
        scan: returnCase.scan,
        updatedAt: now,
      },
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}

export async function saveRouteSelection(returnCase, selectedRoute) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false };
  }

  const { TransactWriteCommand } = await import("@aws-sdk/lib-dynamodb");
  const now = new Date().toISOString();
  const customerId = returnCase.customer.id;

  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `RETURN#${returnCase.id}`,
              sk: `ROUTE#${selectedRoute.id}`,
              entityType: "RouteDecision",
              returnId: returnCase.id,
              customerId,
              itemTitle: returnCase.item.title,
              routeStatus: `${selectedRoute.id}#READY`,
              routeId: selectedRoute.id,
              payout: selectedRoute.payout,
              greenCredits: selectedRoute.greenCredits,
              grade: "A-",
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `RETURN#${returnCase.id}`,
              sk: `PASSPORT#${returnCase.trustPassport.id}`,
              entityType: "TrustPassport",
              returnId: returnCase.id,
              customerId,
              lockedRoute: selectedRoute.shortLabel,
              status: "ready_for_customer_confirmation",
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `CUSTOMER#${customerId}`,
              sk: `CREDIT#${now}#${selectedRoute.id}`,
              entityType: "GreenCreditLedger",
              customerId,
              returnId: returnCase.id,
              creditAmount: selectedRoute.greenCredits,
              reason: selectedRoute.title,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}
