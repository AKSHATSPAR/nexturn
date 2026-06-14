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

export async function saveScanEvaluation(
  returnCase,
  grade,
  recommendedRoute,
  aiAnalysis,
  media,
) {
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
        aiAnalysis,
        media,
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

export async function saveExchangeConnection(returnCase, alternative, exchangeIntent) {
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
              sk: `EXCHANGE#${alternative.id}`,
              entityType: "ExchangeIntent",
              exchangeIntentId: exchangeIntent.id,
              returnId: returnCase.id,
              orderId: returnCase.order.id,
              customerId,
              itemTitle: returnCase.item.title,
              alternativeId: alternative.id,
              alternativeName: alternative.name,
              alternativePrice: alternative.price,
              fitScore: alternative.fit,
              returnRisk: alternative.returnRisk,
              status: exchangeIntent.status,
              priceDelta: exchangeIntent.priceDelta,
              updatedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `CUSTOMER#${customerId}`,
              sk: `ORDER#${returnCase.order.id}#EXCHANGE#${alternative.id}`,
              entityType: "CustomerOrderLink",
              customerId,
              returnId: returnCase.id,
              orderId: returnCase.order.id,
              exchangeIntentId: exchangeIntent.id,
              alternativeId: alternative.id,
              routeStatus: "exchange#CONNECTED",
              creditAmount: 2,
              status: exchangeIntent.status,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}

export async function saveC2CListing(listing) {
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
        ...listing,
        pk: `LISTING#${listing.id}`,
        sk: "PROFILE",
        entityType: "C2CListing",
        listingId: listing.id,
        customerId: listing.sellerId,
        marketplaceStatus: `LISTING#${listing.status.toUpperCase()}`,
        routeStatus: `marketplace#${listing.status.toUpperCase()}`,
        updatedAt: now,
      },
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}

export async function getCustomerProfile(customerId) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false, profile: null };
  }

  const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `CUSTOMER#${customerId}`,
        sk: "PROFILE",
      },
    }),
  );

  return {
    mode: "dynamodb",
    persisted: Boolean(response.Item),
    tableName,
    profile: response.Item ?? null,
  };
}

export async function saveCustomerProfile(identity, profile) {
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
        pk: `CUSTOMER#${identity.customerId}`,
        sk: "PROFILE",
        entityType: "CustomerProfile",
        customerId: identity.customerId,
        email: identity.email,
        name: identity.name,
        address: profile.address,
        updatedAt: now,
      },
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}

export async function listC2CListings() {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false, listings: [] };
  }

  const { QueryCommand } = await import("@aws-sdk/lib-dynamodb");
  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "MarketplaceIndex",
      KeyConditionExpression: "marketplaceStatus = :active",
      ExpressionAttributeValues: {
        ":active": "LISTING#ACTIVE",
      },
      ScanIndexForward: false,
      Limit: 50,
    }),
  );

  return {
    mode: "dynamodb",
    persisted: true,
    tableName,
    listings: response.Items ?? [],
  };
}

export async function saveC2CInterest(listing, interest) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false };
  }

  const { TransactWriteCommand } = await import("@aws-sdk/lib-dynamodb");
  const now = new Date().toISOString();
  const interestCount = Number(listing.interestCount ?? 0) + 1;
  const transactItems = [
    {
      Put: {
        TableName: tableName,
        Item: {
          ...interest,
          pk: `LISTING#${listing.id}`,
          sk: `INTEREST#${interest.id}`,
          entityType: "C2CBuyerInterest",
          customerId: interest.buyerId,
          marketplaceStatus: "INTEREST#QUEUED",
          routeStatus: "interest#QUEUED_FOR_PICKUP_REVIEW",
          updatedAt: now,
        },
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          pk: `CUSTOMER#${interest.buyerId}`,
          sk: `INTEREST#${interest.id}`,
          entityType: "C2CInterestLink",
          customerId: interest.buyerId,
          listingId: listing.id,
          itemTitle: interest.itemTitle,
          sellerId: interest.sellerId,
          status: interest.status,
          paymentStatus: interest.paymentStatus,
          updatedAt: now,
        },
      },
    },
  ];

  if (!listing.id.startsWith("seed_")) {
    transactItems.push({
      Update: {
        TableName: tableName,
        Key: {
          pk: `LISTING#${listing.id}`,
          sk: "PROFILE",
        },
        UpdateExpression: "SET interestCount = :count, updatedAt = :now",
        ExpressionAttributeValues: {
          ":count": interestCount,
          ":now": now,
        },
      },
    });
  }

  await client.send(
    new TransactWriteCommand({
      TransactItems: transactItems,
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}

export async function getC2CListing(listingId) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false, listing: null };
  }

  const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `LISTING#${listingId}`,
        sk: "PROFILE",
      },
    }),
  );

  return {
    mode: "dynamodb",
    persisted: Boolean(response.Item),
    tableName,
    listing: response.Item ?? null,
  };
}

export async function saveC2CCheckout(listing, receipt) {
  const client = await getDocumentClient();
  if (!client) {
    return { mode: "seed", persisted: false };
  }

  const { TransactWriteCommand } = await import("@aws-sdk/lib-dynamodb");
  const now = new Date().toISOString();
  const isPersistedListing = !listing.id.startsWith("seed_");
  const transactItems = [
    {
      Put: {
        TableName: tableName,
        Item: {
          ...receipt,
          pk: `CHECKOUT#${receipt.id}`,
          sk: "RECEIPT",
          entityType: "C2CCheckout",
          customerId: receipt.buyerId,
          marketplaceStatus: "CHECKOUT#PAID",
          routeStatus: "checkout#PAID",
          updatedAt: now,
        },
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          pk: `CUSTOMER#${receipt.buyerId}`,
          sk: `PURCHASE#${receipt.id}`,
          entityType: "C2CPurchaseLink",
          customerId: receipt.buyerId,
          listingId: listing.id,
          itemTitle: receipt.itemTitle,
          sellerId: receipt.sellerId,
          totalPaid: receipt.totalPaid,
          status: receipt.status,
          updatedAt: now,
        },
      },
    },
  ];

  if (isPersistedListing) {
    transactItems.push({
      Update: {
        TableName: tableName,
        Key: {
          pk: `LISTING#${listing.id}`,
          sk: "PROFILE",
        },
        UpdateExpression:
          "SET #status = :sold, marketplaceStatus = :marketplaceStatus, routeStatus = :routeStatus, soldTo = :buyerId, soldAt = :now, updatedAt = :now",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":sold": "sold",
          ":marketplaceStatus": "LISTING#SOLD",
          ":routeStatus": "marketplace#SOLD",
          ":buyerId": receipt.buyerId,
          ":now": now,
        },
      },
    });
  }

  await client.send(
    new TransactWriteCommand({
      TransactItems: transactItems,
    }),
  );

  return { mode: "dynamodb", persisted: true, tableName };
}
