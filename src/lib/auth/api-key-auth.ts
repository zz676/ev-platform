import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiTier } from "@prisma/client";
import { hashApiKey, isLikelyApiKey } from "@/lib/api/api-key";

export const API_TIER_DAILY_LIMIT: Record<ApiTier, number | null> = {
  FREE: 100,
  STARTER: 1000,
  PRO: 10000,
  ENTERPRISE: null, // Unlimited
};

export function getUtcDayBucket(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getNextUtcMidnightEpochSeconds(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor(next.getTime() / 1000);
}

function readApiKeyFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }

  const xKey = headers.get("x-api-key") || headers.get("X-Api-Key");
  return xKey ? xKey.trim() : null;
}

function buildRateLimitHeaders(args: {
  tier: ApiTier;
  limit: number | null;
  remaining: number | null;
  resetEpochSeconds: number | null;
  retryAfterSeconds?: number;
}): Headers {
  const headers = new Headers();
  headers.set("X-Api-Tier", args.tier);

  if (args.limit !== null) headers.set("X-RateLimit-Limit", String(args.limit));
  if (args.remaining !== null) headers.set("X-RateLimit-Remaining", String(args.remaining));
  if (args.resetEpochSeconds !== null) headers.set("X-RateLimit-Reset", String(args.resetEpochSeconds));
  if (typeof args.retryAfterSeconds === "number") {
    headers.set("Retry-After", String(args.retryAfterSeconds));
  }

  return headers;
}

export type ApiKeyAuthContext = {
  apiKey: {
    id: string;
    userId: string;
    tier: ApiTier;
  };
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    resetEpochSeconds: number | null;
  };
  headers: Headers;
};

export async function requireApiKeyAuth(
  request: Request
): Promise<ApiKeyAuthContext | { error: NextResponse }> {
  const rawKey = readApiKeyFromHeaders(request.headers);
  if (!rawKey) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", message: "Missing API key (use Authorization: Bearer <key>)" },
        { status: 401 }
      ),
    };
  }

  if (!isLikelyApiKey(rawKey)) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", message: "Invalid API key" },
        { status: 401 }
      ),
    };
  }

  const keyHash = hashApiKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      tier: true,
      isActive: true,
      lastUsedAt: true,
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", message: "Invalid or revoked API key" },
        { status: 401 }
      ),
    };
  }

  const now = new Date();
  const limit = API_TIER_DAILY_LIMIT[apiKey.tier];
  const resetEpochSeconds = limit === null ? null : getNextUtcMidnightEpochSeconds(now);
  const today = limit === null ? null : getUtcDayBucket(now);

  let usedToday: number | null = null;

  if (limit !== null && today) {
    const shouldUpdateLastUsed =
      !apiKey.lastUsedAt || now.getTime() - apiKey.lastUsedAt.getTime() > 5 * 60 * 1000;

    const [daily] = await prisma.$transaction([
      prisma.apiUsageDaily.upsert({
        where: { apiKeyId_date: { apiKeyId: apiKey.id, date: today } },
        update: { count: { increment: 1 } },
        create: { apiKeyId: apiKey.id, date: today, count: 1 },
        select: { count: true },
      }),
      ...(shouldUpdateLastUsed
        ? [
            prisma.apiKey.update({
              where: { id: apiKey.id },
              data: { lastUsedAt: now },
              select: { id: true },
            }),
          ]
        : []),
    ]);

    usedToday = daily.count;

    if (usedToday > limit) {
      const remaining = 0;
      const retryAfterSeconds = resetEpochSeconds
        ? Math.max(1, resetEpochSeconds - Math.floor(now.getTime() / 1000))
        : undefined;

      const headers = buildRateLimitHeaders({
        tier: apiKey.tier,
        limit,
        remaining,
        resetEpochSeconds,
        retryAfterSeconds,
      });

      return {
        error: NextResponse.json(
          { error: "Rate limit exceeded", limit, reset: resetEpochSeconds },
          { status: 429, headers }
        ),
      };
    }
  } else {
    // Unlimited tiers: still keep an approximate "last used" timestamp.
    const shouldUpdateLastUsed =
      !apiKey.lastUsedAt || now.getTime() - apiKey.lastUsedAt.getTime() > 5 * 60 * 1000;
    if (shouldUpdateLastUsed) {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: now },
        select: { id: true },
      });
    }
  }

  const remaining =
    limit === null || usedToday === null ? null : Math.max(0, limit - usedToday);

  const headers = buildRateLimitHeaders({
    tier: apiKey.tier,
    limit,
    remaining,
    resetEpochSeconds,
  });

  return {
    apiKey: { id: apiKey.id, userId: apiKey.userId, tier: apiKey.tier },
    rateLimit: { limit, remaining, resetEpochSeconds },
    headers,
  };
}

export async function logApiUsage(args: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
}): Promise<void> {
  try {
    await prisma.apiUsage.create({
      data: {
        apiKeyId: args.apiKeyId,
        endpoint: args.endpoint,
        method: args.method,
        statusCode: args.statusCode,
        responseTimeMs: args.responseTimeMs ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    // Don't fail the API request because of analytics logging.
    console.warn("[Data API] Failed to log ApiUsage:", err);
  }
}
