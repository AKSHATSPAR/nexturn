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
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...scanOverrides,
      fileName: file.name,
      mimeType: file.type,
      imageBase64,
    }),
  });

  if (!response.ok) {
    throw new Error(`Scan upload failed with ${response.status}`);
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
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ routeId }),
  });

  if (!response.ok) {
    throw new Error(`Route lock failed with ${response.status}`);
  }

  const payload = await response.json();
  return {
    mode: payload.persistence?.mode ?? "api",
    persisted: Boolean(payload.persistence?.persisted),
    message: payload.customerMessage ?? "Route selection synced.",
  };
}
