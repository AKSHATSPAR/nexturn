import { getAccessToken } from "./auth";

const configuredApiBaseUrl = import.meta.env.VITE_NEXTURN_API_URL;

function getApiBaseUrl() {
  if (configuredApiBaseUrl) return configuredApiBaseUrl;
  if (globalThis.location?.hostname?.includes("execute-api")) return "";
  return null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function jsonHeaders() {
  const token = getAccessToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function apiError(action, response) {
  if (response.status === 401 || response.status === 403) {
    return new Error(`Sign in to ${action}.`);
  }

  return new Error(`${action} failed with ${response.status}`);
}

export async function fetchCustomerResource(endpoint, fallback) {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) return fallback;

  const response = await fetch(`${apiBaseUrl}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Fetch ${endpoint} failed with ${response.status}`);
  }

  return response.json();
}

export async function evaluateScanUpload(file, scanOverrides = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const imageBase64 = await readFileAsDataUrl(file);

  if (apiBaseUrl === null) {
    return {
      mode: "local",
      persisted: false,
      imagePreview: imageBase64,
      aiAnalysis: {
        provider: "local-preview",
        mode: "browser-only",
        usedAws: false,
        confidence: "Local preview",
        labels: [],
        inspectionSignals: ["Upload preview loaded in browser"],
        summary:
          "Local Vite mode cannot call AWS directly. Deploy or set VITE_NEXTURN_API_URL to run Rekognition.",
      },
      media: {
        persisted: false,
        mode: "local-preview",
      },
    };
  }

  const response = await fetch(`${apiBaseUrl}/scan/evaluate`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      ...scanOverrides,
      fileName: file.name,
      mimeType: file.type,
      imageBase64,
    }),
  });

  if (!response.ok) {
    throw apiError("run the AWS AI scan", response);
  }

  const payload = await response.json();
  return {
    ...payload,
    mode: payload.persistence?.mode ?? "api",
    persisted: Boolean(payload.persistence?.persisted),
    imagePreview: imageBase64,
  };
}

export async function lockRoute(routeId) {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) {
    return {
      mode: "local",
      persisted: false,
      message: "Local demo mode. Add VITE_NEXTURN_API_URL to sync route locks.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/route`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ routeId }),
  });

  if (!response.ok) {
    throw apiError("lock this route", response);
  }

  const payload = await response.json();
  return {
    mode: payload.persistence?.mode ?? "api",
    persisted: Boolean(payload.persistence?.persisted),
    message: payload.customerMessage ?? "Route selection synced.",
  };
}

export async function connectExchangeToOrder(alternativeId) {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) {
    return {
      mode: "local",
      persisted: false,
      exchangeIntent: {
        id: `local_exchange_${alternativeId}`,
        status: "connected_locally",
        alternativeId,
      },
      message: "Local demo mode. Deploy or set VITE_NEXTURN_API_URL to persist exchange intents.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/exchange/connect`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ alternativeId }),
  });

  if (!response.ok) {
    throw apiError("connect this exchange to the order", response);
  }

  const payload = await response.json();
  return {
    mode: payload.persistence?.mode ?? "api",
    persisted: Boolean(payload.persistence?.persisted),
    exchangeIntent: payload.exchangeIntent,
    message: payload.customerMessage ?? "Exchange option connected to order.",
  };
}

export async function fetchC2COrders() {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) {
    const { ordersForCustomer } = await import("../lib/c2cCommerce.js");
    return {
      mode: "local",
      orders: ordersForCustomer({
        customerId: "local_customer",
        email: "local@nexturn.local",
        name: "Local Customer",
      }),
      customerMessage: "Local order history loaded from fixtures.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/c2c/orders`, {
    headers: jsonHeaders(),
  });

  if (!response.ok) {
    throw apiError("load your Amazon-anchored order history", response);
  }

  return response.json();
}

export async function fetchC2CMarketplace() {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) {
    const { buildFallbackMarketplace } = await import("../lib/c2cCommerce.js");
    return buildFallbackMarketplace();
  }

  const response = await fetch(`${apiBaseUrl}/c2c/marketplace`);

  if (!response.ok) {
    throw new Error(`Marketplace fetch failed with ${response.status}`);
  }

  return response.json();
}

async function buildListingPayload(file, orderId, sellerCondition = {}) {
  const imageBase64 = file ? await readFileAsDataUrl(file) : undefined;

  return {
    orderId,
    sellerCondition,
    fileName: file?.name,
    mimeType: file?.type,
    imageBase64,
  };
}

export async function evaluateC2CListingUpload(file, orderId, sellerCondition = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const payload = await buildListingPayload(file, orderId, sellerCondition);

  if (apiBaseUrl === null) {
    const {
      createListingFromEvaluation,
      findCustomerOrder,
    } = await import("../lib/c2cCommerce.js");
    const order = findCustomerOrder(orderId, { customerId: "local_customer" });
    const aiAnalysis = {
      provider: "local-preview",
      mode: "browser-only",
      usedAws: false,
      identityStatus: "unknown",
      labels: [],
      summary: "Local preview mode. Deploy or set VITE_NEXTURN_API_URL for AWS AI.",
    };

    return {
      mode: "local",
      listingPreview: createListingFromEvaluation({
        aiAnalysis,
        identity: {
          customerId: "local_customer",
          name: "Local Customer",
          email: "local@nexturn.local",
        },
        order,
        sellerCondition: {
          ...sellerCondition,
          fileName: file?.name,
        },
        uploadedImagePreview: payload.imageBase64,
      }),
      aiAnalysis,
      media: { persisted: false, mode: "local-preview" },
      customerMessage: "Local preview generated without persistence.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/c2c/listings/evaluate`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw apiError("grade this item for C2C resale", response);
  }

  const result = await response.json();
  return {
    ...result,
    imagePreview: payload.imageBase64,
  };
}

export async function createC2CListing(file, orderId, sellerCondition = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const payload = await buildListingPayload(file, orderId, sellerCondition);

  if (apiBaseUrl === null) {
    const preview = await evaluateC2CListingUpload(file, orderId, sellerCondition);
    return {
      ...preview,
      persisted: false,
      listing: preview.listingPreview,
      customerMessage: "Local listing preview created. Deploy to publish globally.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/c2c/listings`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw apiError("publish this C2C listing", response);
  }

  return response.json();
}

export async function checkoutC2CListing(listingId) {
  const apiBaseUrl = getApiBaseUrl();

  if (apiBaseUrl === null) {
    const {
      createCheckoutReceipt,
      seedC2CListings,
    } = await Promise.all([
      import("../lib/c2cCommerce.js"),
      import("../data/c2cCommerce.js"),
    ]).then(([lib, data]) => ({
      createCheckoutReceipt: lib.createCheckoutReceipt,
      seedC2CListings: data.seedC2CListings,
    }));
    const listing = seedC2CListings.find((item) => item.id === listingId);

    return {
      receipt: createCheckoutReceipt({
        buyerIdentity: { customerId: "local_buyer", email: "local@nexturn.local" },
        listing,
      }),
      persistence: { mode: "local", persisted: false },
      customerMessage: "Local checkout simulated.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/c2c/checkout`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ listingId }),
  });

  if (!response.ok) {
    throw apiError("complete this simulated C2C checkout", response);
  }

  return response.json();
}
