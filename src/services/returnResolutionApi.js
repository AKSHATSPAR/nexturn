const configuredApiBaseUrl = import.meta.env.VITE_NEXTURN_API_URL;

function getApiBaseUrl() {
  if (configuredApiBaseUrl) return configuredApiBaseUrl;
  if (globalThis.location?.hostname?.includes("execute-api")) return "";
  return null;
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
