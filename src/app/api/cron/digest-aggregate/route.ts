import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { POSTING_CONFIG } from "@/lib/config/posting";
import { generateDigestContent } from "@/lib/llm/digest";
import { alertNoDigestContent } from "@/lib/email/admin-alerts";

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Get the scheduled digest time for this run
 * Runs at 12:30 and 21:30 UTC, scheduled for 13:00 and 22:00 posting
 */
function getScheduledDigestTime(): Date {
  const now = new Date();
  const hour = now.getUTCHours();

  // If running around 12:30, schedule for 13:00
  // If running around 21:30, schedule for 22:00
  const scheduledHour = hour < 18 ? 13 : 22;

  const scheduled = new Date(now);
  scheduled.setUTCHours(scheduledHour, 0, 0, 0);

  return scheduled;
}

/**
 * Get the time of the last digest (for lookback calculation)
 */
async function getLastDigestTime(): Promise<Date | null> {
  const lastDigest = await prisma.digestContent.findFirst({
    where: { status: "POSTED" },
    orderBy: { postedAt: "desc" },
    select: { postedAt: true },
  });

  return lastDigest?.postedAt || null;
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

    const scheduledFor = getScheduledDigestTime();
    const scheduledTimeStr = scheduledFor.toISOString();

    // Check if content already generated for this slot
    const existing = await prisma.digestContent.findFirst({
      where: {
        scheduledFor,
        status: { in: ["PENDING", "POSTED"] },
      },
    });

    if (existing) {
      return NextResponse.json({
        message: "Digest content already generated for this slot",
        scheduledFor: scheduledTimeStr,
        digestId: existing.id,
      });
    }

    // Calculate lookback time
    const lastDigestTime = await getLastDigestTime();
    const lookbackTime =
      lastDigestTime ||
      new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: 24 hours ago

    // Query ALL eligible posts for digest
    // Score: >= MIN (50) and < VIP (85)
    const eligiblePosts = await prisma.post.findMany({
      where: {
        status: PostStatus.APPROVED,
        publishedToX: false,
        includedInDigest: false,
        relevanceScore: {
          gte: POSTING_CONFIG.MIN_RELEVANCE_SCORE,
          lt: POSTING_CONFIG.VIP_THRESHOLD,
        },
        approvedAt: { gte: lookbackTime },
        translatedSummary: { not: "" },
      },
      orderBy: [{ relevanceScore: "desc" }, { createdAt: "asc" }],
    });

    if (eligiblePosts.length === 0) {
      // Send admin alert
      await alertNoDigestContent(scheduledTimeStr);

      return NextResponse.json({
        message: "No eligible posts for digest",
        scheduledFor: scheduledTimeStr,
        lookbackFrom: lookbackTime.toISOString(),
      });
    }

    // Take top posts based on config
    const postsForDigest = eligiblePosts.slice(
      0,
      POSTING_CONFIG.DIGEST_POSTS_PER_TWEET
    );

    // Generate digest content using LLM
    console.log(
      `[Digest Aggregate] Generating content for ${postsForDigest.length} posts...`
    );
    const digestText = await generateDigestContent(postsForDigest);

    // Find top relevance post for image
    const topPost = postsForDigest.reduce((top, post) =>
      post.relevanceScore > top.relevanceScore ? post : top
    );

    // Save to DigestContent table
    const digestContent = await prisma.digestContent.create({
      data: {
        scheduledFor,
        content: digestText,
        postIds: postsForDigest.map((p) => p.id),
        topPostId: topPost.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      message: "Digest content generated successfully",
      digestId: digestContent.id,
      scheduledFor: scheduledTimeStr,
      postCount: postsForDigest.length,
      topPostId: topPost.id,
      content: digestText,
    });
  } catch (error) {
    console.error("[Digest Aggregate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate digest content" },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
