import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Brand, MetricType, PeriodType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { logApiUsage, requireApiKeyAuth } from "@/lib/auth/api-key-auth";

function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] {
  return Object.values(enumObj).includes(value as T[keyof T]);
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = value.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[\",\n]/.test(s)) return `"${s.replace(/\"/g, "\"\"")}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function getFreeTierCutoffYearMonth(): { year: number; month: number } {
  // "30-day delay" for monthly data approximated as month bucket <= (now - 30 days).
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { year: cutoff.getUTCFullYear(), month: cutoff.getUTCMonth() + 1 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brand: string }> }
) {
  const startedAt = Date.now();
  const { brand: brandParam } = await params;
  const endpoint = `/api/v1/brands/${brandParam}/metrics`;

  const auth = await requireApiKeyAuth(request);
  if ("error" in auth) return auth.error;

  const brand = brandParam.toUpperCase();
  if (!isEnumValue(Brand, brand)) {
    return NextResponse.json(
      { error: "Invalid brand", brand: brandParam },
      { status: 400, headers: auth.headers }
    );
  }

  const { searchParams } = new URL(request.url);

  const metricParam = (searchParams.get("metric") || "DELIVERY").toUpperCase();
  const periodTypeParam = (searchParams.get("periodType") || "MONTHLY").toUpperCase();

  if (!isEnumValue(MetricType, metricParam)) {
    return NextResponse.json(
      { error: "Invalid metric", metric: metricParam },
      { status: 400, headers: auth.headers }
    );
  }
  if (!isEnumValue(PeriodType, periodTypeParam)) {
    return NextResponse.json(
      { error: "Invalid periodType", periodType: periodTypeParam },
      { status: 400, headers: auth.headers }
    );
  }

  const metric = metricParam as MetricType;
  const periodType = periodTypeParam as PeriodType;

  // Tier enforcement
  if (auth.apiKey.tier === "FREE") {
    if (metric !== "DELIVERY" || periodType !== "MONTHLY") {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "FREE tier is limited to MONTHLY DELIVERY data only.",
        },
        { status: 403, headers: auth.headers }
      );
    }
  }

  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "200", 10), 1),
    500
  );
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const skip = (page - 1) * limit;

  const where: Prisma.EVMetricWhereInput = {
    brand: brand as Brand,
    metric,
    periodType,
  };

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Only support from/to for MONTHLY for now.
  if ((fromParam || toParam) && periodType !== "MONTHLY") {
    return NextResponse.json(
      { error: "from/to filters are only supported for periodType=MONTHLY" },
      { status: 400, headers: auth.headers }
    );
  }

  const and: Prisma.EVMetricWhereInput[] = [];

  if (periodType === "MONTHLY") {
    const from = fromParam ? parseYearMonth(fromParam) : null;
    const to = toParam ? parseYearMonth(toParam) : null;

    if (fromParam && !from) {
      return NextResponse.json(
        { error: "Invalid from (expected YYYY-MM)", from: fromParam },
        { status: 400, headers: auth.headers }
      );
    }
    if (toParam && !to) {
      return NextResponse.json(
        { error: "Invalid to (expected YYYY-MM)", to: toParam },
        { status: 400, headers: auth.headers }
      );
    }

    if (from && to) {
      const fromKey = from.year * 100 + from.month;
      const toKey = to.year * 100 + to.month;
      if (fromKey > toKey) {
        return NextResponse.json(
          { error: "Invalid range: from is after to", from: fromParam, to: toParam },
          { status: 400, headers: auth.headers }
        );
      }
    }

    if (from) {
      and.push({
        OR: [
          { year: { gt: from.year } },
          { year: from.year, period: { gte: from.month } },
        ],
      });
    }
    if (to) {
      and.push({
        OR: [
          { year: { lt: to.year } },
          { year: to.year, period: { lte: to.month } },
        ],
      });
    }

    // Free tier data freshness delay
    if (auth.apiKey.tier === "FREE") {
      const cutoff = getFreeTierCutoffYearMonth();
      and.push({
        OR: [
          { year: { lt: cutoff.year } },
          { year: cutoff.year, period: { lte: cutoff.month } },
        ],
      });
    }
  }

  const vehicleModel = searchParams.get("vehicleModel");
  const region = searchParams.get("region");
  const category = searchParams.get("category");
  const dataSource = searchParams.get("dataSource");

  if (vehicleModel) where.vehicleModel = vehicleModel;
  if (region) where.region = region;
  if (category) where.category = category;
  if (dataSource) where.dataSource = dataSource;

  const year = searchParams.get("year");
  const period = searchParams.get("period");
  if (year) where.year = parseInt(year, 10);
  if (period) where.period = parseInt(period, 10);

  if (and.length > 0) where.AND = and;

  const orderBy: Prisma.EVMetricOrderByWithRelationInput[] = [
    { year: "desc" },
    { period: "desc" },
  ];

  const rows = await prisma.eVMetric.findMany({
    where,
    orderBy,
    skip,
    take: limit + 1,
    select: {
      id: true,
      brand: true,
      metric: true,
      periodType: true,
      year: true,
      period: true,
      vehicleModel: true,
      region: true,
      category: true,
      dataSource: true,
      value: true,
      unit: true,
      yoyChange: true,
      momChange: true,
      marketShare: true,
      ranking: true,
      sourceUrl: true,
      sourceTitle: true,
      confidence: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const metrics = hasMore ? rows.slice(0, limit) : rows;

  const format = (searchParams.get("format") || "json").toLowerCase();

  const responseBody = {
    metrics,
    pagination: {
      page,
      limit,
      hasMore,
    },
    dataAsOf: new Date().toISOString(),
  };

  await logApiUsage({
    apiKeyId: auth.apiKey.id,
    endpoint,
    method: "GET",
    statusCode: 200,
    responseTimeMs: Date.now() - startedAt,
  });

  if (format === "csv") {
    const csv = toCsv(
      metrics.map((m) => ({
        id: m.id,
        brand: m.brand,
        metric: m.metric,
        periodType: m.periodType,
        year: m.year,
        period: m.period,
        vehicleModel: m.vehicleModel,
        region: m.region,
        category: m.category,
        dataSource: m.dataSource,
        value: m.value,
        unit: m.unit,
        yoyChange: m.yoyChange,
        momChange: m.momChange,
        marketShare: m.marketShare,
        ranking: m.ranking,
        confidence: m.confidence,
        updatedAt: m.updatedAt.toISOString(),
        sourceUrl: m.sourceUrl,
        sourceTitle: m.sourceTitle,
      }))
    );

    const headers = new Headers(auth.headers);
    headers.set("Content-Type", "text/csv; charset=utf-8");
    return new NextResponse(csv, { status: 200, headers });
  }

  return NextResponse.json(responseBody, { headers: auth.headers });
}
