import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MetricPostStatus } from "@prisma/client";
import { postTweet, uploadMedia } from "@/lib/twitter";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { put } from "@vercel/blob";

// Upload chart image buffer to X
async function uploadChartToX(chartImageBase64: string): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = chartImageBase64.replace(/^data:image\/\w+;base64,/, "");

  // First, we need to upload to a temporary URL since X requires a URL
  // We'll use Vercel Blob for this
  const buffer = Buffer.from(base64Data, "base64");
  const blob = await put(`metric-charts/${Date.now()}.png`, buffer, {
    access: "public",
    contentType: "image/png",
  });

  // Now upload to X from the blob URL
  const mediaId = await uploadMedia(blob.url);
  return mediaId;
}

// POST: Post metric post to X with chart image
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    // Parse optional custom content from request body
    let customText: string | undefined;
    let chartImageBase64: string | undefined;
    try {
      const body = await request.json();
      customText = body.text;
      chartImageBase64 = body.chartImageBase64;
    } catch {
      // No body - use existing content
    }

    const metricPost = await prisma.metricPost.findUnique({
      where: { id },
    });

    if (!metricPost) {
      return NextResponse.json(
        { error: "Metric post not found" },
        { status: 404 }
      );
    }

    if (metricPost.status === "POSTED") {
      return NextResponse.json(
        {
          error: "Already posted to X",
          tweetId: metricPost.tweetId,
          tweetUrl: metricPost.tweetId
            ? `https://x.com/i/status/${metricPost.tweetId}`
            : undefined,
        },
        { status: 400 }
      );
    }

    const tweetText = customText || metricPost.content;
    if (!tweetText) {
      return NextResponse.json(
        { error: "No content to post" },
        { status: 400 }
      );
    }

    // Upload chart image if provided
    let mediaIds: string[] | undefined;
    let chartUrl: string | undefined;

    if (chartImageBase64) {
      try {
        // Store chart in Vercel Blob
        const base64Data = chartImageBase64.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const buffer = Buffer.from(base64Data, "base64");
        const blob = await put(
          `metric-charts/post-${id}-${Date.now()}.png`,
          buffer,
          {
            access: "public",
            contentType: "image/png",
          }
        );
        chartUrl = blob.url;

        // Upload to X
        const mediaId = await uploadMedia(blob.url);
        mediaIds = [mediaId];
        console.log(`[MetricPosts] Chart uploaded to X: ${mediaId}`);
      } catch (chartError) {
        console.error(`[MetricPosts] Chart upload failed:`, chartError);
        // Continue without chart - better to post without image than fail
      }
    } else if (metricPost.chartImageUrl) {
      // Use existing chart URL
      try {
        const mediaId = await uploadMedia(metricPost.chartImageUrl);
        mediaIds = [mediaId];
        chartUrl = metricPost.chartImageUrl;
      } catch (chartError) {
        console.error(`[MetricPosts] Existing chart upload failed:`, chartError);
      }
    }

    // Post tweet
    const tweetResponse = await postTweet(tweetText, mediaIds);
    const tweetId = tweetResponse.data.id;

    // Update metric post
    await prisma.metricPost.update({
      where: { id },
      data: {
        status: MetricPostStatus.POSTED,
        tweetId,
        postedAt: new Date(),
        chartImageUrl: chartUrl || metricPost.chartImageUrl,
        content: tweetText,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      tweetId,
      tweetUrl: `https://x.com/i/status/${tweetId}`,
      hasChart: !!mediaIds,
    });
  } catch (error) {
    console.error("Error posting metric post to X:", error);

    // Try to update status to FAILED
    try {
      const { id } = await params;
      await prisma.metricPost.update({
        where: { id },
        data: {
          status: MetricPostStatus.FAILED,
          updatedAt: new Date(),
        },
      });
    } catch {
      // Ignore update error
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to post to X: ${errorMessage}` },
      { status: 500 }
    );
  }
}
