import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  API_TIER_DAILY_LIMIT,
  getUtcDayBucket,
} from "@/lib/auth/api-key-auth";
import {
  generateApiKeyValue,
  getApiKeyLast4,
  hashApiKey,
} from "@/lib/api/api-key";

export async function GET() {
  const authResult = await requireApiAuth();
  if ("error" in authResult) return authResult.error;

  const userId = authResult.user.id;

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tier: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      last4: true,
      revokedAt: true,
    },
  });

  const keyIds = keys.map((k) => k.id);
  const today = getUtcDayBucket();

  const dailyRows = keyIds.length
    ? await prisma.apiUsageDaily.findMany({
        where: { apiKeyId: { in: keyIds }, date: today },
        select: { apiKeyId: true, count: true },
      })
    : [];

  const dailyByKey = new Map(dailyRows.map((r) => [r.apiKeyId, r.count]));

  return NextResponse.json({
    keys: keys.map((k) => {
      const usedToday = dailyByKey.get(k.id) ?? 0;
      const limit = API_TIER_DAILY_LIMIT[k.tier];
      const remaining = limit === null ? null : Math.max(0, limit - usedToday);
      return {
        ...k,
        usage: {
          usedToday,
          limit,
          remaining,
          dayBucket: today.toISOString(),
        },
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) return authResult.error;

  const userId = authResult.user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await request.json().catch(() => ({}));
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = rawName.trim().slice(0, 64) || null;

  // Default new keys to FREE tier. Upgrades can be applied later (admin/Stripe).
  const apiKeyValue = generateApiKeyValue();
  const keyHash = hashApiKey(apiKeyValue);
  const last4 = getApiKeyLast4(apiKeyValue);

  const created = await prisma.apiKey.create({
    data: {
      userId,
      name,
      tier: "FREE",
      keyHash,
      last4,
    },
    select: {
      id: true,
      name: true,
      tier: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      last4: true,
      revokedAt: true,
    },
  });

  return NextResponse.json(
    {
      apiKey: created,
      plaintextKey: apiKeyValue,
      note: "Copy this key now. You will not be able to see it again.",
    },
    { status: 201 }
  );
}

