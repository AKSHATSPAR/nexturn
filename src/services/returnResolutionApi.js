const apiBaseUrl = import.meta.env.VITE_NEXTURN_API_URL;

export async function lockRoute(routeId) {
  if (!apiBaseUrl) {
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
