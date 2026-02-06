import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function serializeBigInt(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      result[key] = value.toString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Date filters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      const asOfTimeFilter: Record<string, Date> = {};
      if (startDate) {
        asOfTimeFilter.gte = new Date(startDate);
      }
      if (endDate) {
        asOfTimeFilter.lte = new Date(endDate);
      }
      where.asOfTime = asOfTimeFilter;
    }

    const [data, total] = await Promise.all([
      prisma.nioPowerSnapshot.findMany({
        where,
        orderBy: { asOfTime: "desc" },
        skip,
        take: limit,
      }),
      prisma.nioPowerSnapshot.count({ where }),
    ]);

    const serializedData = data.map((row) =>
      serializeBigInt(row as unknown as Record<string, unknown>)
    );

    return NextResponse.json({
      data: serializedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + data.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching NIO Power snapshots:", error);
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

    const {
      asOfTime,
      totalStations,
      swapStations,
      highwaySwapStations,
      cumulativeSwaps,
      chargingStations,
      chargingPiles,
      cumulativeCharges,
      thirdPartyPiles,
      thirdPartyUsagePercent,
    } = body as {
      asOfTime: string;
      totalStations: number;
      swapStations: number;
      highwaySwapStations: number;
      cumulativeSwaps: number | string;
      chargingStations: number;
      chargingPiles: number;
      cumulativeCharges: number | string;
      thirdPartyPiles: number;
      thirdPartyUsagePercent: number;
    };

    if (
      !asOfTime ||
      totalStations === undefined ||
      swapStations === undefined ||
      highwaySwapStations === undefined ||
      cumulativeSwaps === undefined ||
      chargingStations === undefined ||
      chargingPiles === undefined ||
      cumulativeCharges === undefined ||
      thirdPartyPiles === undefined ||
      thirdPartyUsagePercent === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: asOfTime, totalStations, swapStations, highwaySwapStations, cumulativeSwaps, chargingStations, chargingPiles, cumulativeCharges, thirdPartyPiles, thirdPartyUsagePercent",
        },
        { status: 400 }
      );
    }

    const asOfTimeDate = new Date(asOfTime);
    const swapsBigInt = BigInt(cumulativeSwaps);
    const chargesBigInt = BigInt(cumulativeCharges);

    const result = await prisma.nioPowerSnapshot.upsert({
      where: {
        asOfTime: asOfTimeDate,
      },
      update: {
        totalStations,
        swapStations,
        highwaySwapStations,
        cumulativeSwaps: swapsBigInt,
        chargingStations,
        chargingPiles,
        cumulativeCharges: chargesBigInt,
        thirdPartyPiles,
        thirdPartyUsagePercent,
      },
      create: {
        asOfTime: asOfTimeDate,
        totalStations,
        swapStations,
        highwaySwapStations,
        cumulativeSwaps: swapsBigInt,
        chargingStations,
        chargingPiles,
        cumulativeCharges: chargesBigInt,
        thirdPartyPiles,
        thirdPartyUsagePercent,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(result as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Error creating NIO Power snapshot:", {
      message: errorMessage,
      payload: body,
    });
    return NextResponse.json(
      { error: "Failed to create data", details: errorMessage },
      { status: 500 }
    );
  }
}
