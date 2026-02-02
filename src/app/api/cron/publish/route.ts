import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { postTweet, formatTweetContent, uploadMedia } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Configuration
const MAX_POSTS_PER_RUN = 3; // Maximum posts to publish per cron run
const MIN_RELEVANCE_SCORE = 60; // Minimum score to auto-publish

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel Cron sends this header)
    const authHeader = request.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && CRON_SECRET) {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Find posts ready to publish
    // Priority: highest relevance score, approved status, not yet published to X
    const postsToPublish = await prisma.post.findMany({
      where: {
        status: PostStatus.APPROVED,
        publishedToX: false,
        relevanceScore: { gte: MIN_RELEVANCE_SCORE },
        translatedSummary: { not: "" },
      },
      orderBy: [{ relevanceScore: "desc" }, { createdAt: "asc" }],
      take: MAX_POSTS_PER_RUN,
    });

    if (postsToPublish.length === 0) {
      return NextResponse.json({
        message: "No posts to publish",
        published: 0,
      });
    }

    const results = {
      published: 0,
      failed: 0,
      errors: [] as string[],
      tweets: [] as { postId: string; tweetId: string; hasImage: boolean; imageSource: string }[],
    };

    // Publish each post with delay to avoid rate limiting
    for (const post of postsToPublish) {
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
        let imageSource = "none";

        try {
          let imageUrl: string | undefined;

          // Priority 1: Use scraped image from original article
          if (post.originalMediaUrls && post.originalMediaUrls.length > 0) {
            imageUrl = post.originalMediaUrls[0];
            imageSource = "scraped";
            console.log(`Using scraped image for post ${post.id}: ${imageUrl}`);
          }
          // Priority 2: Generate AI image if no scraped image
          else {
            console.log(`No scraped image for post ${post.id}, generating AI image...`);
            imageUrl = await generatePostImage(
              post.translatedTitle || post.originalTitle || "EV News",
              post.translatedSummary || ""
            );
            imageSource = "ai-generated";
          }

          // Upload image to X
          if (imageUrl) {
            const mediaId = await uploadMedia(imageUrl);
            mediaIds = [mediaId];
            console.log(`Image uploaded for post ${post.id}, media_id: ${mediaId}`);
          }
        } catch (imageError) {
          // Log image error but continue with text-only tweet
          console.error(`Failed to process image for post ${post.id}:`, imageError);
          imageSource = "failed";
        }

        // Post to X (with or without media)
        const tweetResponse = await postTweet(tweetText, mediaIds);

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

        results.published++;
        results.tweets.push({
          postId: post.id,
          tweetId: tweetResponse.data.id,
          hasImage: !!mediaIds,
          imageSource,
        });

        // Add delay between posts (5 seconds)
        if (postsToPublish.indexOf(post) < postsToPublish.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.failed++;
        results.errors.push(`${post.id}: ${errorMessage}`);
        console.error(`Failed to publish post ${post.id}:`, error);
      }
    }

    return NextResponse.json({
      message: "Cron publish completed",
      timestamp: new Date().toISOString(),
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
