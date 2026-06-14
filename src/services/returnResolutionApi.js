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
