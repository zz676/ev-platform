import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";
import { Brand, MetricPostStatus, Prisma } from "@prisma/client";
import {
  getAllBrandsComparison,
  getBrandMonthlyTrend,
  getBrandsWithData,
} from "@/lib/metrics/delivery-data";
import {
  generateAllBrandsChart,
  generateBrandTrendChart,
} from "@/lib/charts/metric-charts";
import {
  formatMetricPostTweet,
  generateAllBrandsContent,
  generateBrandTrendContent,
} from "@/lib/llm/metric-posts";
import { findLatestCompleteMonth } from "@/lib/metric-posts/latest-complete-month";

export const runtime = "nodejs";

// Vercel/GitHub cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

const MIN_COMPLETE_BRANDS = parseInt(
  process.env.METRIC_COMPLETE_MIN_BRANDS || "8",
  10
);

function trimTweetTo280(text: string): string {
  if (text.length <= 280) return text;
  const footerIndex = text.lastIndexOf("\n\n🍋 ");
  if (footerIndex > 0) {
    const footer = text.slice(footerIndex);
    const head = text.slice(0, footerIndex).trimEnd();
    const maxHeadLen = 280 - footer.length - 3;
    if (maxHeadLen <= 0) return text.slice(0, 280);
    return `${head.slice(0, maxHeadLen).trimEnd()}...${footer}`;
  }
  return `${text.slice(0, 277).trimEnd()}...`;
}

async function findLatestCompleteDeliveryMonth(): Promise<
  { year: number; month: number; brandCount: number } | null
> {
  const candidates = await prisma.eVMetric.findMany({
    where: {
      metric: "DELIVERY",
      periodType: "MONTHLY",
      brand: { not: Brand.INDUSTRY },
    },
    distinct: ["year", "period"],
    select: { year: true, period: true },
    orderBy: [{ year: "desc" }, { period: "desc" }],
    take: 24,
  });

  return findLatestCompleteMonth({
    candidates: candidates.map((c) => ({ year: c.year, month: c.period })),
    minBrands: MIN_COMPLETE_BRANDS,
    getBrandCount: async (year, month) => {
      const brands = await prisma.eVMetric.findMany({
        where: {
          metric: "DELIVERY",
          periodType: "MONTHLY",
          brand: { not: Brand.INDUSTRY },
          year,
          period: month,
        },
        distinct: ["brand"],
        select: { brand: true },
      });
      return brands.length;
    },
  });
}

async function uploadChartBufferToBlob(params: {
  keyPrefix: string;
  buffer: Buffer;
}): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  const blob = await put(
    `metric-charts/${params.keyPrefix}-${Date.now()}.png`,
    params.buffer,
    { access: "public", contentType: "image/png", token }
  );
  return blob.url;
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

    const complete = await findLatestCompleteDeliveryMonth();
    if (!complete) {
      return NextResponse.json({
        message: "No complete delivery month found",
        minBrands: MIN_COMPLETE_BRANDS,
      });
    }

    const { year, month, brandCount } = complete;

    // Idempotency gate: if the leaderboard exists, we consider this month handled.
    const existingLeaderboard = await prisma.metricPost.findUnique({
      where: {
        postType_year_period_brand: {
          postType: "ALL_BRANDS_COMPARISON",
          year,
          period: month,
          brand: Brand.INDUSTRY,
        },
      },
      select: { id: true, status: true },
    });

    if (existingLeaderboard) {
      return NextResponse.json({
        message: "Metric drafts already generated for latest complete month",
        year,
        month,
        brandCount,
        leaderboardId: existingLeaderboard.id,
        leaderboardStatus: existingLeaderboard.status,
      });
    }

    const created: Array<{ id: string; postType: string; brand: string; period: number }> = [];
    const skipped: Array<{ postType: string; brand: string; period: number; reason: string }> = [];

    // 1) ALL_BRANDS_COMPARISON draft
    const comparisonData = await getAllBrandsComparison(year, month);
    const leaderboardRaw = await generateAllBrandsContent(comparisonData);
    const leaderboardText = trimTweetTo280(
      formatMetricPostTweet(leaderboardRaw, comparisonData.brands.map((b) => b.brand))
    );
    const leaderboardChart = await generateAllBrandsChart(comparisonData);
    const leaderboardChartUrl = await uploadChartBufferToBlob({
      keyPrefix: `cron-all-brands-${year}-${month}`,
      buffer: leaderboardChart,
    });

    const leaderboardPost = await prisma.metricPost.create({
      data: {
        postType: "ALL_BRANDS_COMPARISON",
        year,
        period: month,
        brand: Brand.INDUSTRY,
        content: leaderboardText,
        chartImageUrl: leaderboardChartUrl,
        status: MetricPostStatus.DRAFT,
        dataSnapshot: comparisonData as unknown as Prisma.InputJsonValue,
      },
    });

    created.push({
      id: leaderboardPost.id,
      postType: leaderboardPost.postType,
      brand: leaderboardPost.brand,
      period: leaderboardPost.period,
    });

    // 2) BRAND_TREND drafts for all brands with data in that year (monthly snapshots)
    const brands = (await getBrandsWithData(year)).filter((b) => b !== Brand.INDUSTRY);

    for (const brand of brands) {
      try {
        const trendData = await getBrandMonthlyTrend(brand, year);
        if (!trendData.months.length) {
          skipped.push({
            postType: "BRAND_TREND",
            brand,
            period: month,
            reason: "No trend data",
          });
          continue;
        }

        const asOfMonth = Math.max(...trendData.months.map((m) => m.month));

        const exists = await prisma.metricPost.findUnique({
          where: {
            postType_year_period_brand: {
              postType: "BRAND_TREND",
              year,
              period: asOfMonth,
              brand,
            },
          },
          select: { id: true },
        });

        if (exists) {
          skipped.push({
            postType: "BRAND_TREND",
            brand,
            period: asOfMonth,
            reason: "Already exists",
          });
          continue;
        }

        const trendRaw = await generateBrandTrendContent(trendData);
        const trendText = trimTweetTo280(formatMetricPostTweet(trendRaw, [brand]));
        const trendChart = await generateBrandTrendChart(trendData);
        const trendChartUrl = await uploadChartBufferToBlob({
          keyPrefix: `cron-trend-${brand}-${year}-${asOfMonth}`,
          buffer: trendChart,
        });

        const trendPost = await prisma.metricPost.create({
          data: {
            postType: "BRAND_TREND",
            year,
            period: asOfMonth,
            brand,
            content: trendText,
            chartImageUrl: trendChartUrl,
            status: MetricPostStatus.DRAFT,
            dataSnapshot: trendData as unknown as Prisma.InputJsonValue,
          },
        });

        created.push({
          id: trendPost.id,
          postType: trendPost.postType,
          brand: trendPost.brand,
          period: trendPost.period,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        skipped.push({
          postType: "BRAND_TREND",
          brand,
          period: month,
          reason: `Error: ${msg.slice(0, 120)}`,
        });
      }
    }

    return NextResponse.json({
      message: "Metric drafts generated",
      year,
      month,
      brandCount,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (error) {
    console.error("[Metric Posts Cron] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate metric drafts" },
      { status: 500 }
    );
  }
}

// Manual trigger (POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
