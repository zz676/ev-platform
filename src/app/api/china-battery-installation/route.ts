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
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (year) {
      where.year = parseInt(year);
    }

    if (month) {
      where.month = parseInt(month);
    }

    // Sort order
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Fetch data
    const [data, total] = await Promise.all([
      prisma.chinaBatteryInstallation.findMany({
        where,
        orderBy: [{ year: sortOrder as "asc" | "desc" }, { month: sortOrder as "asc" | "desc" }],
        skip,
        take: limit,
      }),
      prisma.chinaBatteryInstallation.count({ where }),
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
    console.error("Error fetching china battery installation:", error);
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

    const { year, month, installation, sourceUrl, sourceTitle } = body as {
      year: number;
      month: number;
      installation: number;
      sourceUrl: string;
      sourceTitle: string;
    };

    if (!year || !month || installation === undefined || !sourceUrl || !sourceTitle) {
      return NextResponse.json(
        { error: "Missing required fields: year, month, installation, sourceUrl, sourceTitle" },
        { status: 400 }
      );
    }

    const result = await prisma.chinaBatteryInstallation.upsert({
      where: {
        year_month: { year, month },
      },
      update: {
        installation,
        production: body.production as number | undefined,
        unit: (body.unit as string) || "GWh",
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
      create: {
        year,
        month,
        installation,
        production: body.production as number | undefined,
        unit: (body.unit as string) || "GWh",
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating china battery installation:", { message: errorMessage, payload: body });
    return NextResponse.json({ error: "Failed to create data", details: errorMessage }, { status: 500 });
  }
}
