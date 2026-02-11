import crypto from "node:crypto";

const API_KEY_PREFIX = "evk_";

export function generateApiKeyValue(): string {
  // 32 bytes -> 43 chars base64url, high-entropy and URL-safe
  const token = crypto.randomBytes(32).toString("base64url");
  return `${API_KEY_PREFIX}${token}`;
}

export function isLikelyApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 20;
}

export function hashApiKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getApiKeyLast4(value: string): string {
  return value.slice(-4);
}

