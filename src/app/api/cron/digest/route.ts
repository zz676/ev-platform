import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { postTweet, uploadMedia, isImageUrlAccessible } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";
import { POSTING_CONFIG } from "@/lib/config/posting";
import { generateFullDigestTweet } from "@/lib/llm/digest";
import {
  alertNoDigestContent,
  alertDigestPostingFailed,
} from "@/lib/email/admin-alerts";

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Check if X posting is disabled via env var
const SKIP_X_PUBLISH = process.env.SKIP_X_PUBLISH === "true";

/**
 * Get the current digest slot time (13:00 or 22:00 UTC)
 */
function getCurrentDigestSlot(): Date {
  const now = new Date();
  const hour = now.getUTCHours();

  // Determine which slot we're in
  const slotHour = hour < 18 ? 13 : 22;

  const slot = new Date(now);
  slot.setUTCHours(slotHour, 0, 0, 0);

  return slot;
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
    // Verify cron secret
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
        posted: false,
      });
    }

    const digestSlot = getCurrentDigestSlot();
    const slotTimeStr = digestSlot.toISOString();

    // Fetch pre-generated content from DigestContent table
    let digestContent = await prisma.digestContent.findFirst({
      where: {
        scheduledFor: digestSlot,
        status: "PENDING",
      },
    });

    // If no pre-generated content, try to generate inline as fallback
    if (!digestContent) {
      console.log(
        "[Digest] No pre-generated content found, generating inline..."
      );

      // Query eligible posts
      const eligiblePosts = await prisma.post.findMany({
        where: {
          status: PostStatus.APPROVED,
          publishedToX: false,
          includedInDigest: false,
          relevanceScore: {
            gte: POSTING_CONFIG.MIN_RELEVANCE_SCORE,
            lt: POSTING_CONFIG.VIP_THRESHOLD,
          },
          translatedSummary: { not: "" },
        },
        orderBy: [{ relevanceScore: "desc" }, { createdAt: "asc" }],
        take: POSTING_CONFIG.DIGEST_POSTS_PER_TWEET,
      });

      if (eligiblePosts.length === 0) {
        await alertNoDigestContent(slotTimeStr);
        return NextResponse.json({
          message: "No eligible posts for digest",
          scheduledFor: slotTimeStr,
          posted: false,
        });
      }

      // Generate full formatted tweet (title + bullets + link + hashtags)
      const digestText = await generateFullDigestTweet(eligiblePosts);
      const topPost = eligiblePosts.reduce((top, post) =>
        post.relevanceScore > top.relevanceScore ? post : top
      );

      // Create inline digest content
      digestContent = await prisma.digestContent.create({
        data: {
          scheduledFor: digestSlot,
          content: digestText,
          postIds: eligiblePosts.map((p) => p.id),
          topPostId: topPost.id,
          status: "PENDING",
        },
      });
    }

    // Fetch posts for the digest (needed for image selection)
    const posts = await prisma.post.findMany({
      where: { id: { in: digestContent.postIds } },
    });

    // Get top post for image
    const topPost = posts.find((p) => p.id === digestContent!.topPostId);

    // Use stored content directly (already includes title + bullets + link + hashtags)
    const tweetText = digestContent.content;

    // Try to get image from top post
    let mediaIds: string[] | undefined;
    let imageSource = "none";
    let imageUrl: string | undefined;
    let imageError: string | undefined;

    if (POSTING_CONFIG.DIGEST_INCLUDE_IMAGE && topPost) {
      console.log(`[Digest] Image processing enabled for top post: ${topPost.id}`);
      console.log(`[Digest] Top post cardImageUrl: ${topPost.cardImageUrl || "none"}`);
      console.log(`[Digest] Top post originalMediaUrls: ${JSON.stringify(topPost.originalMediaUrls || [])}`);

      try {
        // Priority 1: Use cardImageUrl (AI-generated or good-ratio original) - but validate accessibility first
        if (topPost.cardImageUrl) {
          const isOriginal = topPost.originalMediaUrls?.includes(topPost.cardImageUrl);
          const potentialSource = isOriginal ? "scraped" : "ai-generated";
          console.log(`[Digest] Checking cardImageUrl accessibility: ${topPost.cardImageUrl}`);
          
          // Validate that the image URL is actually accessible (especially for scraped Weibo images)
          const isAccessible = await isImageUrlAccessible(topPost.cardImageUrl);
          
          if (isAccessible) {
            imageUrl = topPost.cardImageUrl;
            imageSource = potentialSource;
            console.log(`[Digest] Using existing cardImageUrl: ${imageUrl}`);
            console.log(`[Digest] Image source determined as: ${imageSource}`);
          } else {
            console.log(`[Digest] cardImageUrl is not accessible (likely blocked Weibo image), falling back to AI generation`);
          }
        }
        
        // Priority 2: Generate AI image (also used as fallback when cardImageUrl is inaccessible)
        if (!imageUrl) {
          console.log("[Digest] Generating AI image...");
          imageUrl = await generatePostImage(
            topPost.translatedTitle || topPost.originalTitle || "EV Juice Digest",
            topPost.translatedSummary || "",
            { source: "cron_digest", postId: topPost.id }
          );
          imageSource = "ai-generated";
          console.log(`[Digest] AI image generated: ${imageUrl}`);
        }

        // Upload image to X
        if (imageUrl) {
          console.log(`[Digest] Attempting to upload image to X: ${imageUrl}`);
          const mediaId = await uploadMedia(imageUrl);
          mediaIds = [mediaId];
          console.log(`[Digest] Image upload successful, media_id: ${mediaId}`);
        } else {
          console.log("[Digest] No imageUrl available after processing");
          imageSource = "none";
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Digest] Image processing failed: ${errorMsg}`);
        console.error("[Digest] Full error:", err);
        imageSource = "failed";
        imageError = errorMsg;
      }
    } else {
      if (!POSTING_CONFIG.DIGEST_INCLUDE_IMAGE) {
        console.log("[Digest] Image processing disabled in config");
      }
      if (!topPost) {
        console.log("[Digest] No top post available for image");
      }
    }

    // Post to X
    let tweetResponse;
    try {
      tweetResponse = await postTweet(tweetText, mediaIds);
    } catch (postError) {
      const errorMessage =
        postError instanceof Error ? postError.message : "Unknown error";

      // Update digest status to FAILED
      await prisma.digestContent.update({
        where: { id: digestContent.id },
        data: { status: "FAILED" },
      });

      await alertDigestPostingFailed(slotTimeStr, errorMessage);

      return NextResponse.json(
        {
          error: "Failed to post digest to X",
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // Update digest content status
    await prisma.digestContent.update({
      where: { id: digestContent.id },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        tweetId: tweetResponse.data.id,
      },
    });

    // Mark posts as included in digest
    await prisma.post.updateMany({
      where: { id: { in: digestContent.postIds } },
      data: {
        includedInDigest: true,
        digestTweetId: tweetResponse.data.id,
      },
    });

    // Log the posting
    await logPosting("DIGEST", tweetResponse.data.id, digestContent.postIds);

    return NextResponse.json({
      message: "Digest posted successfully",
      digestId: digestContent.id,
      tweetId: tweetResponse.data.id,
      scheduledFor: slotTimeStr,
      postCount: digestContent.postIds.length,
      hasImage: !!mediaIds,
      imageSource,
      imageUrl: imageUrl || null,
      imageError: imageError || null,
    });
  } catch (error) {
    console.error("[Digest] Error:", error);
    return NextResponse.json(
      { error: "Failed to post digest" },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
