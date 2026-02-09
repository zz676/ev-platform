import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/auth/api-auth";

// POST: Track AI usage (for external services like scraper OCR)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { type, model, cost, success, source } = body;

    if (!type || !model || cost === undefined || success === undefined || !source) {
      return NextResponse.json(
        { error: "Missing required fields: type, model, cost, success, source" },
        { status: 400 }
      );
    }

    // Validate types
    if (typeof cost !== "number" || cost < 0) {
      return NextResponse.json(
        { error: "cost must be a non-negative number" },
        { status: 400 }
      );
    }

    if (typeof success !== "boolean") {
      return NextResponse.json(
        { error: "success must be a boolean" },
        { status: 400 }
      );
    }

    // Create the usage record
    const record = await prisma.aIUsage.create({
      data: {
        type,
        model,
        cost,
        success,
        source,
        size: body.size || null,
        errorMsg: body.errorMsg || null,
        postId: body.postId || null,
        inputTokens: body.inputTokens || null,
        outputTokens: body.outputTokens || null,
        durationMs: body.durationMs || null,
      },
    });

    return NextResponse.json({
      success: true,
      id: record.id,
      message: "AI usage tracked successfully",
    });
  } catch (error) {
    console.error("Error tracking AI usage:", error);
    return NextResponse.json(
      { error: "Failed to track AI usage" },
      { status: 500 }
    );
  }
}

// GET: Get AI usage statistics
export async function GET(request: NextRequest) {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100
    );
    const skip = (page - 1) * limit;

    // Get total stats
    const totalStats = await prisma.aIUsage.aggregate({
      _sum: { cost: true },
      _count: { id: true },
    });

    // Get stats by source
    const bySource = await prisma.aIUsage.groupBy({
      by: ["source"],
      _sum: { cost: true },
      _count: { id: true },
      where: { success: true },
    });

    // Get stats by success/failure
    const successStats = await prisma.aIUsage.groupBy({
      by: ["success"],
      _sum: { cost: true },
      _count: { id: true },
    });

    // Get daily stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyUsage = await prisma.$queryRaw<
      Array<{ date: string; count: bigint; cost: number }>
    >`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as count,
        SUM(cost) as cost
      FROM "AIUsage"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND success = true
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
    `;

    const [recentUsage, totalRecent] = await Promise.all([
      prisma.aIUsage.findMany({
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          model: true,
          size: true,
          cost: true,
          success: true,
          errorMsg: true,
          postId: true,
          source: true,
          createdAt: true,
          inputTokens: true,
          outputTokens: true,
          durationMs: true,
        },
      }),
      prisma.aIUsage.count(),
    ]);

    return NextResponse.json({
      summary: {
        totalCost: totalStats._sum.cost || 0,
        totalCalls: totalStats._count.id,
        successfulCalls:
          successStats.find((s) => s.success)?._count.id || 0,
        failedCalls:
          successStats.find((s) => !s.success)?._count.id || 0,
      },
      bySource: bySource.map((s) => ({
        source: s.source,
        cost: s._sum.cost || 0,
        count: s._count.id,
      })),
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        count: Number(d.count),
        cost: d.cost || 0,
      })),
      recentUsage,
      recentUsagePagination: {
        page,
        limit,
        total: totalRecent,
        totalPages: Math.ceil(totalRecent / limit),
        hasMore: skip + recentUsage.length < totalRecent,
      },
    });
  } catch (error) {
    console.error("Error fetching AI usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage" },
      { status: 500 }
    );
  }
}
