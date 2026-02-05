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
    const plant = searchParams.get("plant");
    const brand = searchParams.get("brand");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (plant) {
      where.plant = plant;
    }

    if (brand) {
      where.brand = brand;
    }

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
      prisma.plantExports.findMany({
        where,
        orderBy: [{ year: sortOrder as "asc" | "desc" }, { month: sortOrder as "asc" | "desc" }],
        skip,
        take: limit,
      }),
      prisma.plantExports.count({ where }),
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
    console.error("Error fetching plant exports:", error);
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

    const { plant, brand, year, month, value, sourceUrl, sourceTitle } = body as {
      plant: string;
      brand: string;
      year: number;
      month: number;
      value: number;
      sourceUrl: string;
      sourceTitle: string;
    };

    if (!plant || !brand || !year || !month || value === undefined || !sourceUrl || !sourceTitle) {
      return NextResponse.json(
        { error: "Missing required fields: plant, brand, year, month, value, sourceUrl, sourceTitle" },
        { status: 400 }
      );
    }

    const result = await prisma.plantExports.upsert({
      where: {
        plant_year_month: { plant, year, month },
      },
      update: {
        brand,
        value,
        unit: (body.unit as string) || "vehicles",
        yoyChange: body.yoyChange as number | undefined,
        momChange: body.momChange as number | undefined,
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
      create: {
        plant,
        brand,
        year,
        month,
        value,
        unit: (body.unit as string) || "vehicles",
        yoyChange: body.yoyChange as number | undefined,
        momChange: body.momChange as number | undefined,
        description: body.description as string | undefined,
        sourceUrl,
        sourceTitle,
        imageUrl: body.imageUrl as string | undefined,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating plant exports:", { message: errorMessage, payload: body });
    return NextResponse.json({ error: "Failed to create data", details: errorMessage }, { status: 500 });
  }
}
