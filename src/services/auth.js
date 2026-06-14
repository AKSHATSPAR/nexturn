const AUTH_CONFIG_ENDPOINT = "/auth-config.json";
const SESSION_KEY = "nexturn.auth.session.v1";
const PKCE_KEY = "nexturn.auth.pkce.v1";

function browserAvailable() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function base64UrlEncode(value) {
  const bytes =
    value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function codeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

function decodeJwt(token) {
  if (!token) return {};
  const [, payload] = token.split(".");
  if (!payload) return {};

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function normalizeConfig(config = {}) {
  const enabled = Boolean(
    config.enabled &&
      config.clientId &&
      config.domain &&
      config.redirectUri,
  );

  return {
    enabled,
    googleEnabled: Boolean(enabled && config.googleEnabled),
    clientId: config.clientId ?? "",
    domain: config.domain ?? "",
    redirectUri: config.redirectUri ?? globalThis.location?.origin + "/",
    logoutUri: config.logoutUri ?? globalThis.location?.origin + "/",
    region: config.region ?? "us-east-1",
  };
}

export async function loadAuthConfig() {
  if (!browserAvailable()) return normalizeConfig();

  try {
    const response = await fetch(AUTH_CONFIG_ENDPOINT, { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      return normalizeConfig();
    }

    return normalizeConfig(await response.json());
  } catch {
    return normalizeConfig();
  }
}

export function getStoredSession() {
  if (!browserAvailable()) return null;

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!session?.accessToken || !session?.expiresAt) return null;
    if (session.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getAccessToken() {
  return getStoredSession()?.idToken ?? getStoredSession()?.accessToken ?? null;
}

function storeSession(tokenResponse) {
  const idClaims = decodeJwt(tokenResponse.id_token);
  const accessClaims = decodeJwt(tokenResponse.access_token);
  const expiresAt =
    accessClaims.exp ??
    Math.floor(Date.now() / 1000) + Number(tokenResponse.expires_in ?? 3600);
  const session = {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    user: {
      email: idClaims.email ?? accessClaims.username ?? "",
      name: idClaims.name ?? idClaims.given_name ?? idClaims.email ?? "Signed-in customer",
      subject: idClaims.sub ?? accessClaims.sub ?? "",
    },
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function exchangeCodeForTokens(config, code) {
  const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null");
  if (!pkce?.verifier) {
    throw new Error("Sign-in session expired. Please start sign-in again.");
  }

  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: pkce.verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not complete sign-in (${response.status}).`);
  }

  sessionStorage.removeItem(PKCE_KEY);
  return storeSession(await response.json());
}

export async function completeAuthRedirect(config) {
  if (!browserAvailable() || !config.enabled) return null;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    throw new Error(error);
  }
  if (!code) return null;

  const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null");
  if (!pkce?.state || pkce.state !== returnedState) {
    throw new Error("Sign-in state did not match. Please try again.");
  }

  const session = await exchangeCodeForTokens(config, code);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  return session;
}

export async function initializeAuth() {
  const config = await loadAuthConfig();

  try {
    const redirectedSession = await completeAuthRedirect(config);
    return {
      config,
      session: redirectedSession ?? getStoredSession(),
      error: null,
    };
  } catch (error) {
    return {
      config,
      session: getStoredSession(),
      error: error.message,
    };
  }
}

export async function signIn(config, provider) {
  if (!config?.enabled) {
    throw new Error("Auth is not configured for this environment.");
  }
  if (provider === "Google" && !config.googleEnabled) {
    throw new Error("Google sign-in needs Google OAuth credentials before it can be enabled.");
  }

  const verifier = randomString(48);
  const state = randomString(24);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge_method: "S256",
    code_challenge: await codeChallenge(verifier),
  });

  if (provider) {
    params.set("identity_provider", provider);
  }

  window.location.assign(`${config.domain}/oauth2/authorize?${params.toString()}`);
}

export function signOut(config) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PKCE_KEY);

  if (!config?.enabled) {
    window.location.reload();
    return;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });
  window.location.assign(`${config.domain}/logout?${params.toString()}`);
}
