import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Brand, VehicleType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Filters
    const brand = searchParams.get("brand") as Brand | null;
    const vehicleType = searchParams.get("vehicleType") as VehicleType | null;
    const segment = searchParams.get("segment");
    const model = searchParams.get("model");

    // Price range filters
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    // Range filter
    const minRange = searchParams.get("minRange");

    // Build where clause
    const where: Record<string, unknown> = {};

    if (brand) {
      where.brand = brand;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    if (segment) {
      where.segment = segment;
    }

    if (model) {
      where.model = { contains: model, mode: "insensitive" };
    }

    if (minPrice || maxPrice) {
      where.startingPrice = {};
      if (minPrice) {
        (where.startingPrice as Record<string, number>).gte = parseInt(minPrice);
      }
      if (maxPrice) {
        (where.startingPrice as Record<string, number>).lte = parseInt(maxPrice);
      }
    }

    if (minRange) {
      where.rangeCltc = { gte: parseInt(minRange) };
    }

    // Determine sort order
    const sortBy = searchParams.get("sortBy") || "brand";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build orderBy
    let orderBy: Record<string, string>[];
    switch (sortBy) {
      case "price":
        orderBy = [{ startingPrice: sortOrder }];
        break;
      case "range":
        orderBy = [{ rangeCltc: sortOrder }];
        break;
      case "model":
        orderBy = [{ model: sortOrder }];
        break;
      default:
        orderBy = [{ brand: sortOrder }, { model: "asc" }];
    }

    // Fetch specs
    const [specs, total] = await Promise.all([
      prisma.vehicleSpec.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.vehicleSpec.count({ where }),
    ]);

    return NextResponse.json({
      specs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + specs.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching vehicle specs:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicle specs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { brand, model, variant } = body;

    if (!brand || !model || !variant) {
      return NextResponse.json(
        { error: "Missing required fields: brand, model, variant" },
        { status: 400 }
      );
    }

    // Create or update spec (upsert)
    const result = await prisma.vehicleSpec.upsert({
      where: {
        brand_model_variant: {
          brand,
          model,
          variant,
        },
      },
      update: {
        launchDate: body.launchDate,
        vehicleType: body.vehicleType,
        segment: body.segment,
        startingPrice: body.startingPrice,
        currentPrice: body.currentPrice,
        lengthMm: body.lengthMm,
        widthMm: body.widthMm,
        heightMm: body.heightMm,
        wheelbaseMm: body.wheelbaseMm,
        acceleration: body.acceleration,
        topSpeed: body.topSpeed,
        motorPowerKw: body.motorPowerKw,
        motorTorqueNm: body.motorTorqueNm,
        batteryCapacity: body.batteryCapacity,
        rangeCltc: body.rangeCltc,
        rangeWltp: body.rangeWltp,
        rangeEpa: body.rangeEpa,
        fuelTankVolume: body.fuelTankVolume,
        engineDisplacement: body.engineDisplacement,
        maxChargingPower: body.maxChargingPower,
        chargingTime10To80: body.chargingTime10To80,
        sourceUrl: body.sourceUrl,
        confidence: body.confidence || 1.0,
      },
      create: {
        brand,
        model,
        variant,
        launchDate: body.launchDate,
        vehicleType: body.vehicleType,
        segment: body.segment,
        startingPrice: body.startingPrice,
        currentPrice: body.currentPrice,
        lengthMm: body.lengthMm,
        widthMm: body.widthMm,
        heightMm: body.heightMm,
        wheelbaseMm: body.wheelbaseMm,
        acceleration: body.acceleration,
        topSpeed: body.topSpeed,
        motorPowerKw: body.motorPowerKw,
        motorTorqueNm: body.motorTorqueNm,
        batteryCapacity: body.batteryCapacity,
        rangeCltc: body.rangeCltc,
        rangeWltp: body.rangeWltp,
        rangeEpa: body.rangeEpa,
        fuelTankVolume: body.fuelTankVolume,
        engineDisplacement: body.engineDisplacement,
        maxChargingPower: body.maxChargingPower,
        chargingTime10To80: body.chargingTime10To80,
        sourceUrl: body.sourceUrl,
        confidence: body.confidence || 1.0,
      },
    });

    return NextResponse.json({
      success: true,
      spec: result,
    });
  } catch (error) {
    console.error("Error creating vehicle spec:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle spec" },
      { status: 500 }
    );
  }
}
