import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { MetricPostStatus } from "@prisma/client";
import { POSTING_CONFIG } from "@/lib/config/posting";
import { publishMetricPost } from "@/lib/metric-posts/publish";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET;
const SKIP_X_PUBLISH = process.env.SKIP_X_PUBLISH === "true";

const METRIC_MAX_PER_RUN = parseInt(
  process.env.METRIC_MAX_PER_RUN || "2",
  10
);

async function getTodayPostCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return prisma.postingLog.count({
    where: {
      createdAt: { gte: startOfDay },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && CRON_SECRET) {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (SKIP_X_PUBLISH) {
      return NextResponse.json({
        message: "X publishing is disabled (SKIP_X_PUBLISH=true)",
        posted: 0,
      });
    }

    const todayCount = await getTodayPostCount();
    if (todayCount >= POSTING_CONFIG.MAX_POSTS_PER_DAY) {
      return NextResponse.json({
        message: "Daily post limit reached",
        posted: 0,
        todayCount,
        limit: POSTING_CONFIG.MAX_POSTS_PER_DAY,
      });
    }

    const remainingAllowed = Math.min(
      METRIC_MAX_PER_RUN,
      POSTING_CONFIG.MAX_POSTS_PER_DAY - todayCount
    );

    const approved = await prisma.metricPost.findMany({
      where: { status: MetricPostStatus.APPROVED },
      orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
      take: remainingAllowed,
    });

    if (approved.length === 0) {
      return NextResponse.json({
        message: "No approved metric posts to publish",
        posted: 0,
      });
    }

    const results = {
      attempted: approved.length,
      posted: 0,
      failed: 0,
      skipped: 0,
      items: [] as Array<{
        id: string;
        status: string;
        ok: boolean;
        tweetId?: string;
        error?: string;
        reason?: string;
      }>,
    };

    for (const post of approved) {
      const r = await publishMetricPost({
        id: post.id,
        expectedStatuses: [MetricPostStatus.APPROVED],
      });

      results.items.push({
        id: post.id,
        status: r.status,
        ok: r.ok,
        tweetId: r.tweetId,
        error: r.error,
        reason: r.reason,
      });

      if (r.ok && r.status === MetricPostStatus.POSTED) results.posted += 1;
      else if (r.skipped) results.skipped += 1;
      else results.failed += 1;
    }

    return NextResponse.json({
      message: "Metric publish run complete",
      ...results,
    });
  } catch (error) {
    console.error("[Metric Posts Publish Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to publish approved metric posts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

