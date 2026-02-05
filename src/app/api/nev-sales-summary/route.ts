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
    const year = searchParams.get("year");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (dataSource) {
      where.dataSource = dataSource;
    }

    if (year) {
      where.year = parseInt(year);
    }

    // Sort order
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Fetch data
    const [data, total] = await Promise.all([
      prisma.nevSalesSummary.findMany({
        where,
        orderBy: [
          { year: sortOrder as "asc" | "desc" },
          { startDate: sortOrder as "asc" | "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.nevSalesSummary.count({ where }),
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
    console.error("Error fetching NEV sales summary:", error);
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

    const { year, startDate, endDate, retailSales, sourceUrl, sourceTitle } = body as {
      year: number;
      startDate: string;
      endDate: string;
      retailSales: number;
      sourceUrl: string;
      sourceTitle: string;
    };

    if (!year || !startDate || !endDate || retailSales === undefined || !sourceUrl || !sourceTitle) {
      return NextResponse.json(
        { error: "Missing required fields: year, startDate, endDate, retailSales, sourceUrl, sourceTitle" },
        { status: 400 }
      );
    }

    const dataSource = (body.dataSource as string) || "CPCA";

    const result = await prisma.nevSalesSummary.upsert({
      where: {
        dataSource_year_startDate_endDate: { dataSource, year, startDate, endDate },
      },
      update: {
        retailSales,
        retailYoy: body.retailYoy as number | undefined,
        retailMom: body.retailMom as number | undefined,
        wholesaleSales: body.wholesaleSales as number | undefined,
        wholesaleYoy: body.wholesaleYoy as number | undefined,
        wholesaleMom: body.wholesaleMom as number | undefined,
        unit: (body.unit as string) || "vehicles",
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
      create: {
        dataSource,
        year,
        startDate,
        endDate,
        retailSales,
        retailYoy: body.retailYoy as number | undefined,
        retailMom: body.retailMom as number | undefined,
        wholesaleSales: body.wholesaleSales as number | undefined,
        wholesaleYoy: body.wholesaleYoy as number | undefined,
        wholesaleMom: body.wholesaleMom as number | undefined,
        unit: (body.unit as string) || "vehicles",
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating NEV sales summary:", { message: errorMessage, payload: body });
    return NextResponse.json({ error: "Failed to create data", details: errorMessage }, { status: 500 });
  }
}
