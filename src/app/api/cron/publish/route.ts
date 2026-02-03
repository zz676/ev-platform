import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus, ImageSource } from "@prisma/client";
import { postTweet, formatTweetContent, uploadMedia } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";
import {
  canAttemptPublish,
  startPublishingAttempt,
  recordPublishSuccess,
  recordPublishFailure,
  hasImageFailed,
  MAX_ATTEMPTS,
} from "@/lib/x-publication";
import { POSTING_CONFIG } from "@/lib/config/posting";
import { alertDailyLimitReached } from "@/lib/email/admin-alerts";

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Check if X posting is disabled via env var
const SKIP_X_PUBLISH = process.env.SKIP_X_PUBLISH === "true";

/**
 * Get count of posts published to X today
 */
async function getTodayPostCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const count = await prisma.postingLog.count({
    where: {
      createdAt: { gte: startOfDay },
    },
  });

  return count;
}

/**
 * Log a posting action to the database
 */
async function logPosting(
  postType: "VIP" | "DIGEST" | "MANUAL",
  tweetId: string,
  postIds: string[]
): Promise<void> {
  await prisma.postingLog.create({
    data: {
      postType,
      tweetId,
      postIds,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel Cron sends this header)
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && CRON_SECRET) {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Check if posting is disabled
    if (SKIP_X_PUBLISH) {
      return NextResponse.json({
        message: "X publishing is disabled (SKIP_X_PUBLISH=true)",
        published: 0,
      });
    }

    // Check daily rate limit
    const todayCount = await getTodayPostCount();
    if (todayCount >= POSTING_CONFIG.MAX_POSTS_PER_DAY) {
      await alertDailyLimitReached(todayCount);
      return NextResponse.json({
        message: "Daily post limit reached",
        published: 0,
        todayCount,
        limit: POSTING_CONFIG.MAX_POSTS_PER_DAY,
      });
    }

    // Calculate remaining posts allowed today
    const remainingAllowed = Math.min(
      POSTING_CONFIG.MAX_VIP_PER_RUN,
      POSTING_CONFIG.MAX_POSTS_PER_DAY - todayCount
    );

    if (remainingAllowed <= 0) {
      return NextResponse.json({
        message: "No remaining posts allowed for this run",
        published: 0,
      });
    }

    // Find VIP posts ready to publish (score >= VIP_THRESHOLD)
    // Exclude posts already included in a digest
    const postsToPublish = await prisma.post.findMany({
      where: {
        status: PostStatus.APPROVED,
        publishedToX: false,
        includedInDigest: false,
        relevanceScore: { gte: POSTING_CONFIG.VIP_THRESHOLD },
        translatedSummary: { not: "" },
      },
      orderBy: [{ relevanceScore: "desc" }, { createdAt: "asc" }],
      take: remainingAllowed,
    });

    if (postsToPublish.length === 0) {
      return NextResponse.json({
        message: "No VIP posts to publish",
        published: 0,
        threshold: POSTING_CONFIG.VIP_THRESHOLD,
      });
    }

    const results = {
      published: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      tweets: [] as {
        postId: string;
        tweetId: string;
        hasImage: boolean;
        imageSource: string;
      }[],
    };

    // Publish each post with delay to avoid rate limiting
    for (const post of postsToPublish) {
      // Check if we should attempt publishing (respects MAX_ATTEMPTS)
      const { allowed, reason } = await canAttemptPublish(post.id);
      if (!allowed) {
        console.log(`Skipping post ${post.id}: ${reason}`);
        results.skipped++;
        continue;
      }

      // Start tracking this attempt
      const { attempts } = await startPublishingAttempt(post.id);
      console.log(`Publishing attempt ${attempts}/${MAX_ATTEMPTS} for post ${post.id}`);

      try {
        // Format tweet content
        const tweetText = formatTweetContent({
          translatedTitle: post.translatedTitle,
          translatedSummary: post.translatedSummary || "",
          categories: post.categories,
          source: post.source,
          sourceUrl: post.sourceUrl,
        });

        // Try to get an image for the tweet
        let mediaIds: string[] | undefined;
        let mediaId: string | undefined;
        let imageSource: ImageSource = ImageSource.NONE;

        // Skip image upload if it previously failed (saves API calls)
        const imagePreviouslyFailed = await hasImageFailed(post.id);
        if (imagePreviouslyFailed) {
          console.log(`Skipping image for post ${post.id}: previous upload failed`);
          imageSource = ImageSource.FAILED;
        } else {
          try {
            let imageUrl: string | undefined;

            // Priority 1: Use cardImageUrl (AI-generated or good-ratio original)
            if (post.cardImageUrl) {
              imageUrl = post.cardImageUrl;
              // Determine source based on whether it matches originalMediaUrls
              const isOriginal = post.originalMediaUrls?.includes(post.cardImageUrl);
              imageSource = isOriginal ? ImageSource.SCRAPED : ImageSource.AI_GENERATED;
              console.log(`Using card image for post ${post.id}: ${imageUrl} (${imageSource})`);
            }
            // Priority 2: Generate AI image if no cardImageUrl
            else {
              console.log(`No card image for post ${post.id}, generating AI image...`);
              imageUrl = await generatePostImage(
                post.translatedTitle || post.originalTitle || "EV News",
                post.translatedSummary || ""
              );
              imageSource = ImageSource.AI_GENERATED;
            }

            // Upload image to X
            if (imageUrl) {
              mediaId = await uploadMedia(imageUrl);
              mediaIds = [mediaId];
              console.log(`Image uploaded for post ${post.id}, media_id: ${mediaId}`);
            }
          } catch (imageError) {
            // Log image error but continue with text-only tweet
            console.error(`Failed to process image for post ${post.id}:`, imageError);
            imageSource = ImageSource.FAILED;
          }
        }

        // Post to X (with or without media)
        const tweetResponse = await postTweet(tweetText, mediaIds);

        // Record success in XPublication
        await recordPublishSuccess(post.id, {
          tweetId: tweetResponse.data.id,
          imageSource,
          mediaId,
        });

        // Update post in database
        await prisma.post.update({
          where: { id: post.id },
          data: {
            publishedToX: true,
            xPostId: tweetResponse.data.id,
            xPublishedAt: new Date(),
            status: PostStatus.PUBLISHED,
          },
        });

        // Log the posting
        await logPosting("VIP", tweetResponse.data.id, [post.id]);

        results.published++;
        results.tweets.push({
          postId: post.id,
          tweetId: tweetResponse.data.id,
          hasImage: !!mediaIds,
          imageSource: imageSource.toLowerCase(),
        });

        // Add delay between posts (5 seconds)
        if (postsToPublish.indexOf(post) < postsToPublish.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Record failure in XPublication
        const { attempts: totalAttempts, maxReached } = await recordPublishFailure(post.id, errorMessage);

        results.failed++;
        results.errors.push(`${post.id}: ${errorMessage} (attempt ${totalAttempts}/${MAX_ATTEMPTS}${maxReached ? " - max reached" : ""})`);
        console.error(`Failed to publish VIP post ${post.id} (attempt ${totalAttempts}):`, error);
      }
    }

    return NextResponse.json({
      message: "VIP cron publish completed",
      timestamp: new Date().toISOString(),
      threshold: POSTING_CONFIG.VIP_THRESHOLD,
      maxAttemptsPerPost: MAX_ATTEMPTS,
      results,
    });
  } catch (error) {
    console.error("Cron publish error:", error);
    return NextResponse.json(
      { error: "Failed to run cron publish" },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (POST)
export async function POST(request: NextRequest) {
  // Same logic as GET but for manual triggers
  return GET(request);
}
