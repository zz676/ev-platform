import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus, Prisma } from "@prisma/client";
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
const BLOCKED_IMAGE_HOSTS = new Set(["sinaimg.cn"]);

function isBlockedImageUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (BLOCKED_IMAGE_HOSTS.has(hostname)) return true;
    for (const host of BLOCKED_IMAGE_HOSTS) {
      if (hostname.endsWith(`.${host}`)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

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

    const digestSelect = {
      id: true,
      scheduledFor: true,
      content: true,
      postIds: true,
      topPostId: true,
      status: true,
    } as const;

    // Fetch pre-generated content from DigestContent table
    let digestContent = await prisma.digestContent.findFirst({
      where: {
        scheduledFor: digestSlot,
        status: "PENDING",
      },
      select: digestSelect,
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
        select: digestSelect,
      });
    }

    // Fetch posts for the digest (needed for image selection)
    const posts = await prisma.post.findMany({
      where: { id: { in: digestContent.postIds } },
    });

    const postsById = new Map(posts.map((post) => [post.id, post]));
    const orderedPosts = digestContent.postIds
      .map((id) => postsById.get(id))
      .filter((post): post is (typeof posts)[number] => Boolean(post));

    // Get top post for image (fallback to first available post)
    const topPost = postsById.get(digestContent.topPostId) || orderedPosts[0];

    // Use stored content directly (already includes title + bullets + link + hashtags)
    const tweetText = digestContent.content;

    // Try to get image from top post
    let mediaIds: string[] | undefined;
    let imageSource = "none";
    let imageUrl: string | undefined;
    let imageError: string | undefined;

    if (POSTING_CONFIG.DIGEST_INCLUDE_IMAGE && orderedPosts.length > 0) {
      console.log(
        `[Digest] Image processing enabled for ${orderedPosts.length} digest posts`
      );

      const triedUrls = new Set<string>();
      let lastImageError: string | undefined;
      let selectedImageUrl: string | undefined;
      let selectedImageSource: "scraped" | "ai-generated" | "none" = "none";

      const tryUploadCandidate = async (
        candidateUrl: string,
        source: "scraped" | "ai-generated"
      ) => {
        console.log(`[Digest] Checking image accessibility: ${candidateUrl}`);
        const isAccessible = await isImageUrlAccessible(candidateUrl);
        if (!isAccessible) {
          console.log(`[Digest] Image not accessible: ${candidateUrl}`);
          return null;
        }

        try {
          console.log(`[Digest] Attempting to upload image to X: ${candidateUrl}`);
          const mediaId = await uploadMedia(candidateUrl);
          console.log(`[Digest] Image upload successful, media_id: ${mediaId}`);
          return { mediaId, imageUrl: candidateUrl, imageSource: source };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Digest] Image upload failed: ${errorMsg}`);
          lastImageError = errorMsg;
          return null;
        }
      };

      try {
        for (const post of orderedPosts) {
          const candidates: string[] = [];
          if (post.cardImageUrl) candidates.push(post.cardImageUrl);
          if (post.originalMediaUrls?.length) {
            for (const url of post.originalMediaUrls) {
              if (url && url !== post.cardImageUrl) candidates.push(url);
            }
          }

          if (candidates.length === 0) {
            console.log(`[Digest] No image candidates for post ${post.id}`);
            continue;
          }

          for (const candidateUrl of candidates) {
            if (!candidateUrl || triedUrls.has(candidateUrl)) continue;
            if (isBlockedImageUrl(candidateUrl)) {
              console.log(`[Digest] Skipping blocked image host: ${candidateUrl}`);
              continue;
            }
            triedUrls.add(candidateUrl);

            const isOriginal = post.originalMediaUrls?.includes(candidateUrl);
            const source = isOriginal ? "scraped" : "ai-generated";
            const uploadResult = await tryUploadCandidate(candidateUrl, source);
            if (uploadResult) {
              mediaIds = [uploadResult.mediaId];
              selectedImageUrl = uploadResult.imageUrl;
              selectedImageSource = uploadResult.imageSource;
              break;
            }
          }

          if (mediaIds) break;
        }

        if (!mediaIds && topPost) {
          console.log(
            "[Digest] No usable scraped images found, generating AI image..."
          );
          let generatedUrl: string | undefined;
          try {
            generatedUrl = await generatePostImage(
              topPost.translatedTitle || topPost.originalTitle || "EV Juice Digest",
              topPost.translatedSummary || "",
              { source: "cron_digest", postId: topPost.id }
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Digest] AI image generation failed: ${errorMsg}`);
            lastImageError = errorMsg;
          }

          if (generatedUrl) {
            const uploadResult = await tryUploadCandidate(
              generatedUrl,
              "ai-generated"
            );
            if (uploadResult) {
              mediaIds = [uploadResult.mediaId];
              selectedImageUrl = uploadResult.imageUrl;
              selectedImageSource = uploadResult.imageSource;
            }
          }
        }

        if (mediaIds && selectedImageUrl) {
          imageUrl = selectedImageUrl;
          imageSource = selectedImageSource;

          try {
            await prisma.digestContent.update({
              where: { id: digestContent.id },
              data: { digestImageUrl: selectedImageUrl },
              select: { id: true },
            });
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2022"
            ) {
              console.warn(
                "[Digest] digestImageUrl column missing; skipping write"
              );
            } else {
              throw err;
            }
          }
        } else {
          console.log("[Digest] No image uploaded for digest");
          imageSource = "none";
          if (lastImageError) {
            imageError = lastImageError;
          }
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
      if (orderedPosts.length === 0) {
        console.log("[Digest] No posts available for image selection");
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
        select: { id: true },
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
      select: { id: true },
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
