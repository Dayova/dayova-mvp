import { existsSync, readFileSync } from "node:fs";

/**
 * Parse dotenv content into a key/value record.
 * Only supports plain KEY=VALUE lines used in this project.
 */
function parseEnv(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }
  return result;
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return parseEnv(readFileSync(path, "utf8"));
}

const merged = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
};

const baseUrl = process.env.EXPO_PUBLIC_AUTH_API_BASE_URL || merged.EXPO_PUBLIC_AUTH_API_BASE_URL;

if (!baseUrl) {
  console.log("[auth] EXPO_PUBLIC_AUTH_API_BASE_URL ist nicht gesetzt.");
  process.exit(0);
}

try {
  const url = new URL(baseUrl);
  const protocolPort = url.protocol === "https:" ? 443 : 80;
  const port = url.port ? Number(url.port) : protocolPort;
  console.log(`[auth] Backend Base URL: ${baseUrl}`);
  console.log(`[auth] Host: ${url.hostname}`);
  console.log(`[auth] Port: ${port}`);
} catch {
  console.log(`[auth] Ungültige EXPO_PUBLIC_AUTH_API_BASE_URL: ${baseUrl}`);
}
