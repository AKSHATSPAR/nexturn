import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const binaryTypes = new Set([".ico", ".jpg", ".jpeg", ".png", ".webp"]);

function resolveAsset(rawPath = "/") {
  const decoded = decodeURIComponent(rawPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const safePath = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.join(distDir, safePath);

  if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
    return candidate;
  }

  return path.join(distDir, "index.html");
}

function authConfigResponse() {
  const body = {
    enabled: process.env.NEX_TURN_AUTH_ENABLED === "true",
    googleEnabled: process.env.NEX_TURN_AUTH_GOOGLE_ENABLED === "true",
    clientId: process.env.NEX_TURN_AUTH_CLIENT_ID ?? "",
    domain: process.env.NEX_TURN_AUTH_DOMAIN ?? "",
    redirectUri: process.env.NEX_TURN_AUTH_REDIRECT_URI ?? "",
    logoutUri: process.env.NEX_TURN_AUTH_LOGOUT_URI ?? "",
    region: process.env.AWS_REGION ?? "us-east-1",
  };

  return {
    statusCode: 200,
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event = {}) {
  const rawPath = event.rawPath ?? event.path ?? "/";
  if (rawPath === "/auth-config.json") {
    return authConfigResponse();
  }

  const assetPath = resolveAsset(rawPath);
  const ext = path.extname(assetPath).toLowerCase();
  const buffer = await readFile(assetPath);
  const isBinary = binaryTypes.has(ext);

  return {
    statusCode: 200,
    headers: {
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
      "content-type": contentTypes[ext] ?? "application/octet-stream",
    },
    isBase64Encoded: isBinary,
    body: isBinary ? buffer.toString("base64") : buffer.toString("utf8"),
  };
}
