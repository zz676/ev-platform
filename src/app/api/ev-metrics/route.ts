import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Brand, MetricType, PeriodType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Filters
    const brand = searchParams.get("brand") as Brand | null;
    const metric = searchParams.get("metric") as MetricType | null;
    const periodType = searchParams.get("periodType") as PeriodType | null;
    const year = searchParams.get("year");
    const period = searchParams.get("period");
    const region = searchParams.get("region");
    const vehicleModel = searchParams.get("vehicleModel");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (brand) {
      where.brand = brand;
    }

    if (metric) {
      where.metric = metric;
    }

    if (periodType) {
      where.periodType = periodType;
    }

    if (year) {
      where.year = parseInt(year);
    }

    if (period) {
      where.period = parseInt(period);
    }

    if (region) {
      where.region = region;
    }

    if (vehicleModel) {
      where.vehicleModel = vehicleModel;
    }

    // Determine sort order
    const sortBy = searchParams.get("sortBy") || "year";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build orderBy
    let orderBy: Record<string, string>[];
    if (sortBy === "value") {
      orderBy = [{ value: sortOrder }];
    } else {
      // Default: sort by year/period descending
      orderBy = [
        { year: sortOrder },
        { period: sortOrder },
      ];
    }

    // Fetch metrics
    const [metrics, total] = await Promise.all([
      prisma.eVMetric.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
          createdAt: true,
        },
      }),
      prisma.eVMetric.count({ where }),
    ]);

    return NextResponse.json({
      metrics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + metrics.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching EV metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch EV metrics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {};
  try {
    body = await request.json();

    // Validate required fields
    const { brand, metric, periodType, year, period, value } = body;

    if (!brand || !metric || !periodType || !year || !period || value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: brand, metric, periodType, year, period, value" },
        { status: 400 }
      );
    }

    // Create or update metric (upsert)
    const result = await prisma.eVMetric.upsert({
      where: {
        brand_metric_periodType_year_period_vehicleModel_region_category_dataSource: {
          brand,
          metric,
          periodType,
          year,
          period,
          vehicleModel: body.vehicleModel || "",
          region: body.region || "",
          category: body.category || "",
          dataSource: body.dataSource || "",
        },
      },
      update: {
        value,
        unit: body.unit,
        yoyChange: body.yoyChange,
        momChange: body.momChange,
        marketShare: body.marketShare,
        ranking: body.ranking,
        sourceUrl: body.sourceUrl,
        sourceTitle: body.sourceTitle,
        confidence: body.confidence || 1.0,
      },
      create: {
        brand,
        metric,
        periodType,
        year,
        period,
        vehicleModel: body.vehicleModel || "",
        region: body.region || "",
        category: body.category || "",
        dataSource: body.dataSource || "",
        value,
        unit: body.unit,
        yoyChange: body.yoyChange,
        momChange: body.momChange,
        marketShare: body.marketShare,
        ranking: body.ranking,
        sourceUrl: body.sourceUrl,
        sourceTitle: body.sourceTitle,
        confidence: body.confidence || 1.0,
      },
    });

    return NextResponse.json({
      success: true,
      metric: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const prismaCode = (error as { code?: string })?.code;
    const prismaMeta = (error as { meta?: unknown })?.meta;

    console.error("Error creating EV metric:", {
      message: errorMessage,
      code: prismaCode,
      meta: prismaMeta,
      payload: body
    });

    return NextResponse.json({
      error: "Failed to create EV metric",
      details: errorMessage,
      code: prismaCode,
      meta: prismaMeta
    }, { status: 500 });
  }
}
