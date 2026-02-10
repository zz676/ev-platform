import { put } from "@vercel/blob";
import { Brand, MetricPostStatus, MetricPostType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { postTweet, uploadMedia } from "@/lib/twitter";
import {
  generateAllBrandsChart,
  generateBrandTrendChart,
} from "@/lib/charts/metric-charts";
import {
  getAllBrandsComparison,
  getBrandMonthlyTrend,
} from "@/lib/metrics/delivery-data";

function trimTweetTo280(text: string): string {
  if (text.length <= 280) return text;

  // Try to preserve the standard footer format used by formatMetricPostTweet().
  const footerIndex = text.lastIndexOf("\n\n🍋 ");
  if (footerIndex > 0) {
    const footer = text.slice(footerIndex);
    const head = text.slice(0, footerIndex).trimEnd();
    const maxHeadLen = 280 - footer.length - 3; // "..."
    if (maxHeadLen <= 0) return text.slice(0, 280);
    return `${head.slice(0, maxHeadLen).trimEnd()}...${footer}`;
  }

  return `${text.slice(0, 277).trimEnd()}...`;
}

async function uploadChartBufferToBlob(params: {
  metricPostId: string;
  buffer: Buffer;
}): Promise<string> {
  const blob = await put(
    `metric-charts/post-${params.metricPostId}-${Date.now()}.png`,
    params.buffer,
    { access: "public", contentType: "image/png" }
  );

  return blob.url;
}

function decodeBase64Image(dataUrlOrBase64: string): Buffer {
  const base64Data = dataUrlOrBase64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

async function ensureChartUrl(metricPost: {
  id: string;
  postType: MetricPostType;
  year: number;
  period: number;
  brand: Brand;
  chartImageUrl: string | null;
  dataSnapshot: unknown;
}): Promise<{ chartUrl: string; generated: boolean }> {
  if (metricPost.chartImageUrl) {
    return { chartUrl: metricPost.chartImageUrl, generated: false };
  }

  if (metricPost.postType === "ALL_BRANDS_COMPARISON") {
    const data =
      (metricPost.dataSnapshot as Parameters<typeof generateAllBrandsChart>[0]) ||
      (await getAllBrandsComparison(metricPost.year, metricPost.period));
    const buffer = await generateAllBrandsChart(data);
    const chartUrl = await uploadChartBufferToBlob({
      metricPostId: metricPost.id,
      buffer,
    });
    return { chartUrl, generated: true };
  }

  if (metricPost.postType === "BRAND_TREND") {
    const data =
      (metricPost.dataSnapshot as Parameters<typeof generateBrandTrendChart>[0]) ||
      (await getBrandMonthlyTrend(metricPost.brand, metricPost.year));
    const buffer = await generateBrandTrendChart(data);
    const chartUrl = await uploadChartBufferToBlob({
      metricPostId: metricPost.id,
      buffer,
    });
    return { chartUrl, generated: true };
  }

  throw new Error(`Unsupported MetricPostType: ${metricPost.postType}`);
}

export async function publishMetricPost(params: {
  id: string;
  expectedStatuses: MetricPostStatus[];
  overrideText?: string;
  overrideChartImageBase64?: string;
  approvedBy?: string;
}): Promise<{
  ok: boolean;
  status: MetricPostStatus;
  tweetId?: string;
  tweetUrl?: string;
  chartUrl?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}> {
  const metricPost = await prisma.metricPost.findUnique({
    where: { id: params.id },
  });

  if (!metricPost) {
    return { ok: false, status: MetricPostStatus.FAILED, error: "Not found" };
  }

  if (metricPost.status === MetricPostStatus.POSTED) {
    return {
      ok: true,
      status: MetricPostStatus.POSTED,
      tweetId: metricPost.tweetId || undefined,
      tweetUrl: metricPost.tweetId
        ? `https://x.com/i/status/${metricPost.tweetId}`
        : undefined,
      chartUrl: metricPost.chartImageUrl || undefined,
      skipped: true,
      reason: "Already posted",
    };
  }

  const initialStatus = metricPost.status;

  // Acquire a lock (idempotent) so we don't double-post.
  const locked = await prisma.metricPost.updateMany({
    where: {
      id: metricPost.id,
      status: { in: params.expectedStatuses },
    },
    data: {
      status: MetricPostStatus.POSTING,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
      approvedBy: params.approvedBy ?? metricPost.approvedBy,
    },
  });

  if (locked.count === 0) {
    const latest = await prisma.metricPost.findUnique({
      where: { id: metricPost.id },
      select: { status: true },
    });
    return {
      ok: false,
      status: latest?.status || MetricPostStatus.FAILED,
      skipped: true,
      reason: "Not in an expected status to publish (likely already processing)",
    };
  }

  const refreshed = await prisma.metricPost.findUnique({
    where: { id: metricPost.id },
  });
  if (!refreshed) {
    return { ok: false, status: MetricPostStatus.FAILED, error: "Not found" };
  }

  const maxAttempts = parseInt(process.env.METRIC_MAX_ATTEMPTS || "2", 10);
  const retryBaseStatus =
    initialStatus === MetricPostStatus.APPROVED
      ? MetricPostStatus.APPROVED
      : MetricPostStatus.DRAFT;

  try {
    const tweetText = trimTweetTo280(params.overrideText || refreshed.content);

    // Resolve chart URL (override -> stored -> generated from snapshot/DB)
    let chartUrl = refreshed.chartImageUrl || null;
    let generatedChart = false;

    if (params.overrideChartImageBase64) {
      const buffer = decodeBase64Image(params.overrideChartImageBase64);
      chartUrl = await uploadChartBufferToBlob({
        metricPostId: refreshed.id,
        buffer,
      });
      generatedChart = true;
    } else {
      const ensured = await ensureChartUrl({
        id: refreshed.id,
        postType: refreshed.postType,
        year: refreshed.year,
        period: refreshed.period,
        brand: refreshed.brand,
        chartImageUrl: refreshed.chartImageUrl,
        dataSnapshot: refreshed.dataSnapshot,
      });
      chartUrl = ensured.chartUrl;
      generatedChart = ensured.generated;
    }

    // Upload chart to X (required).
    const mediaId = await uploadMedia(chartUrl);

    const tweetResponse = await postTweet(tweetText, [mediaId]);
    const tweetId = tweetResponse.data.id;

    await prisma.$transaction([
      prisma.metricPost.update({
        where: { id: refreshed.id },
        data: {
          status: MetricPostStatus.POSTED,
          tweetId,
          postedAt: new Date(),
          chartImageUrl: chartUrl,
          content: tweetText,
          lastError: null,
          updatedAt: new Date(),
        },
      }),
      prisma.postingLog.create({
        data: {
          postType: "METRIC",
          tweetId,
          postIds: [refreshed.id],
        },
      }),
    ]);

    // If we generated a chart URL during publish, persist it for future retries / audit.
    if (generatedChart && refreshed.chartImageUrl !== chartUrl) {
      // Best-effort: transaction above already updated chartImageUrl, so this is just a guard.
    }

    return {
      ok: true,
      status: MetricPostStatus.POSTED,
      tweetId,
      tweetUrl: `https://x.com/i/status/${tweetId}`,
      chartUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const nextStatus =
      refreshed.attempts >= maxAttempts
        ? MetricPostStatus.FAILED
        : retryBaseStatus;

    await prisma.metricPost.update({
      where: { id: refreshed.id },
      data: {
        status: nextStatus,
        lastError: message.slice(0, 500),
        updatedAt: new Date(),
      },
    });

    return {
      ok: false,
      status: nextStatus,
      error: message,
    };
  }
}
