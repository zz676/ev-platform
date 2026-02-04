import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/auth/api-auth";

// GET: Get AI usage statistics
export async function GET() {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
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

    // Get recent usage records
    const recentUsage = await prisma.aIUsage.findMany({
      take: 50,
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
      },
    });

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
    });
  } catch (error) {
    console.error("Error fetching AI usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage" },
      { status: 500 }
    );
  }
}
