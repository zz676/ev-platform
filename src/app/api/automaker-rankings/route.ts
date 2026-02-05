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
    const automaker = searchParams.get("automaker");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (dataSource) {
      where.dataSource = dataSource;
    }

    if (automaker) {
      where.automaker = automaker;
    }

    if (year) {
      where.year = parseInt(year);
    }

    if (month) {
      where.month = parseInt(month);
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
      prisma.automakerRankings.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.automakerRankings.count({ where }),
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
    console.error("Error fetching automaker rankings:", error);
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

    const { year, month, ranking, automaker, value, sourceUrl, sourceTitle } = body as {
      year: number;
      month: number;
      ranking: number;
      automaker: string;
      value: number;
      sourceUrl: string;
      sourceTitle: string;
    };

    if (!year || !month || !ranking || !automaker || value === undefined || !sourceUrl || !sourceTitle) {
      return NextResponse.json(
        { error: "Missing required fields: year, month, ranking, automaker, value, sourceUrl, sourceTitle" },
        { status: 400 }
      );
    }

    const dataSource = (body.dataSource as string) || "CPCA";

    const result = await prisma.automakerRankings.upsert({
      where: {
        dataSource_year_month_automaker: { dataSource, year, month, automaker },
      },
      update: {
        ranking,
        value,
        unit: (body.unit as string) || "vehicles",
        yoyChange: body.yoyChange as number | undefined,
        momChange: body.momChange as number | undefined,
        marketShare: body.marketShare as number | undefined,
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
      create: {
        dataSource,
        year,
        month,
        ranking,
        automaker,
        value,
        unit: (body.unit as string) || "vehicles",
        yoyChange: body.yoyChange as number | undefined,
        momChange: body.momChange as number | undefined,
        marketShare: body.marketShare as number | undefined,
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating automaker rankings:", { message: errorMessage, payload: body });
    return NextResponse.json({ error: "Failed to create data", details: errorMessage }, { status: 500 });
  }
}
