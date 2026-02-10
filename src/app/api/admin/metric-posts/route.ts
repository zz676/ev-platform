import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Brand, MetricPostStatus, MetricPostType, Prisma } from "@prisma/client";
import { requireApiAdmin } from "@/lib/auth/api-auth";

// GET: List metric posts with filters
export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as MetricPostStatus | null;
    const postType = searchParams.get("postType") as MetricPostType | null;
    const year = searchParams.get("year");
    const brand = searchParams.get("brand");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.MetricPostWhereInput = {};
    if (status) where.status = status;
    if (postType) where.postType = postType;
    if (year) where.year = parseInt(year);
    if (brand) where.brand = brand as Brand;

    const [posts, total] = await Promise.all([
      prisma.metricPost.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.metricPost.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.metricPost.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const statsMap = {
      total: 0,
      draft: 0,
      approved: 0,
      posting: 0,
      posted: 0,
      failed: 0,
      skipped: 0,
    };

    stats.forEach((stat) => {
      const count = stat._count.id;
      statsMap.total += count;
      switch (stat.status) {
        case "DRAFT":
          statsMap.draft = count;
          break;
        case "APPROVED":
          statsMap.approved = count;
          break;
        case "POSTING":
          statsMap.posting = count;
          break;
        case "POSTED":
          statsMap.posted = count;
          break;
        case "FAILED":
          statsMap.failed = count;
          break;
        case "SKIPPED":
          statsMap.skipped = count;
          break;
      }
    });

    return NextResponse.json({
      posts,
      stats: statsMap,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching metric posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch metric posts" },
      { status: 500 }
    );
  }
}

// POST: Save a new metric post
export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const {
      postType,
      year,
      period,
      brand,
      content,
      chartImageUrl,
      dataSnapshot,
    } = body;

    // Validate required fields
    if (!postType || !year || !content) {
      return NextResponse.json(
        { error: "postType, year, and content are required" },
        { status: 400 }
      );
    }

    if (!period) {
      return NextResponse.json({ error: "period is required" }, { status: 400 });
    }

    // Normalize brand/period requirements so the unique key is always valid.
    const resolvedBrand: Brand =
      postType === "ALL_BRANDS_COMPARISON"
        ? Brand.INDUSTRY
        : (brand as Brand);

    if (postType === "BRAND_TREND" && !resolvedBrand) {
      return NextResponse.json(
        { error: "brand is required for BRAND_TREND" },
        { status: 400 }
      );
    }

    // Check for existing post with same parameters
    const existing = await prisma.metricPost.findUnique({
      where: {
        postType_year_period_brand: {
          postType,
          year,
          period,
          brand: resolvedBrand,
        },
      },
    });

    if (existing) {
      if (existing.status === "POSTED") {
        return NextResponse.json(
          { error: "Cannot edit a post that has already been posted to X" },
          { status: 409 }
        );
      }

      if (existing.status === "POSTING" || existing.status === "APPROVED") {
        return NextResponse.json(
          { error: "Cannot edit a post that is approved or currently posting" },
          { status: 409 }
        );
      }

      // Update existing post
      const updated = await prisma.metricPost.update({
        where: { id: existing.id },
        data: {
          content,
          chartImageUrl,
          dataSnapshot,
          status: "DRAFT",
          lastError: null,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        post: updated,
        updated: true,
      });
    }

    // Create new post
    const post = await prisma.metricPost.create({
      data: {
        postType,
        year,
        period,
        brand: resolvedBrand,
        content,
        chartImageUrl,
        dataSnapshot,
        status: "DRAFT",
      },
    });

    return NextResponse.json({
      success: true,
      post,
      updated: false,
    });
  } catch (error) {
    console.error("Error saving metric post:", error);
    return NextResponse.json(
      { error: "Failed to save metric post" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a metric post
export async function DELETE(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.metricPost.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting metric post:", error);
    return NextResponse.json(
      { error: "Failed to delete metric post" },
      { status: 500 }
    );
  }
}
