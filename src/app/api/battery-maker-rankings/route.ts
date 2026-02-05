import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Filters
    const dataSource = searchParams.get("dataSource");
    const scope = searchParams.get("scope");
    const maker = searchParams.get("maker");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const periodType = searchParams.get("periodType");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (dataSource) {
      where.dataSource = dataSource;
    }

    if (scope) {
      where.scope = scope;
    }

    if (maker) {
      where.maker = maker;
    }

    if (year) {
      where.year = parseInt(year);
    }

    if (month) {
      where.month = parseInt(month);
    }

    if (periodType) {
      where.periodType = periodType;
    }

    // Sort order
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const sortBy = searchParams.get("sortBy") || "year";

    // Build orderBy
    let orderBy: Record<string, string>[];
    if (sortBy === "ranking") {
      orderBy = [{ ranking: "asc" }];
    } else if (sortBy === "value") {
      orderBy = [{ value: sortOrder }];
    } else {
      orderBy = [
        { year: sortOrder },
        { month: sortOrder },
        { ranking: "asc" },
      ];
    }

    // Fetch data
    const [data, total] = await Promise.all([
      prisma.batteryMakerRankings.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.batteryMakerRankings.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching battery maker rankings:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();

    const { dataSource, scope, year, ranking, maker, value, sourceUrl, sourceTitle } = body as {
      dataSource: string;
      scope: string;
      year: number;
      ranking: number;
      maker: string;
      value: number;
      sourceUrl: string;
      sourceTitle: string;
    };

    if (!dataSource || !scope || !year || !ranking || !maker || value === undefined || !sourceUrl || !sourceTitle) {
      return NextResponse.json(
        { error: "Missing required fields: dataSource, scope, year, ranking, maker, value, sourceUrl, sourceTitle" },
        { status: 400 }
      );
    }

    const month = (body.month as number | undefined) ?? null;
    const periodType = (body.periodType as string) || "MONTHLY";

    // For upsert with nullable month in composite key, we need to handle null specially
    // First try to find existing record
    const existing = await prisma.batteryMakerRankings.findFirst({
      where: {
        dataSource,
        scope,
        year,
        month,
        maker,
      },
    });

    let result;
    if (existing) {
      result = await prisma.batteryMakerRankings.update({
        where: { id: existing.id },
        data: {
          periodType,
          ranking,
          value,
          unit: (body.unit as string) || "GWh",
          yoyChange: body.yoyChange as number | undefined,
          marketShare: body.marketShare as number | undefined,
          shareVsPrevMonth: body.shareVsPrevMonth as number | undefined,
          description: body.description as string | undefined,
          sourceUrl,
          sourceTitle,
          imageUrl: body.imageUrl as string | undefined,
        },
      });
    } else {
      result = await prisma.batteryMakerRankings.create({
        data: {
          dataSource,
          scope,
          periodType,
          year,
          month,
          ranking,
          maker,
          value,
          unit: (body.unit as string) || "GWh",
          yoyChange: body.yoyChange as number | undefined,
          marketShare: body.marketShare as number | undefined,
          shareVsPrevMonth: body.shareVsPrevMonth as number | undefined,
          description: body.description as string | undefined,
          sourceUrl,
          sourceTitle,
          imageUrl: body.imageUrl as string | undefined,
        },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating battery maker rankings:", { message: errorMessage, payload: body });
    return NextResponse.json({ error: "Failed to create data", details: errorMessage }, { status: 500 });
  }
}
