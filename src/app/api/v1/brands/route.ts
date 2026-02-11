import { NextRequest, NextResponse } from "next/server";
import { Brand } from "@prisma/client";
import { BRAND_DISPLAY_NAMES } from "@/lib/metrics/delivery-data";
import { logApiUsage, requireApiKeyAuth } from "@/lib/auth/api-key-auth";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const endpoint = "/api/v1/brands";

  const auth = await requireApiKeyAuth(request);
  if ("error" in auth) return auth.error;

  const brands = Object.values(Brand)
    .filter((b) => b !== "INDUSTRY" && b !== "OTHER_BRAND")
    .map((b) => ({ code: b, name: BRAND_DISPLAY_NAMES[b] || b }));

  await logApiUsage({
    apiKeyId: auth.apiKey.id,
    endpoint,
    method: "GET",
    statusCode: 200,
    responseTimeMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      brands,
      dataAsOf: new Date().toISOString(),
    },
    { headers: auth.headers }
  );
}
