import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus, ImageSource } from "@prisma/client";
import { postTweet, formatTweetContent, uploadMedia } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import {
  canManualRetry,
  startPublishingAttempt,
  recordPublishSuccess,
  recordPublishFailure,
  MAX_ATTEMPTS,
} from "@/lib/x-publication";

// Request body type for custom content
interface PostToXRequest {
  text?: string;
  imageUrl?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    // Parse optional custom content from request body
    let customContent: PostToXRequest = {};
    try {
      const body = await request.text();
      if (body) {
        customContent = JSON.parse(body);
      }
    } catch {
      // No body or invalid JSON - use auto-generated content
    }

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.status !== PostStatus.APPROVED && post.status !== PostStatus.PUBLISHED) {
      return NextResponse.json(
        { error: "Post must be approved before posting to X" },
        { status: 400 }
      );
    }

    // Check if manual retry is allowed (always allowed unless already published)
    const { allowed, reason, xPublication } = await canManualRetry(id);
    if (!allowed) {
      return NextResponse.json(
        {
          error: reason || "Cannot post to X",
          tweetUrl: post.xPostId ? `https://x.com/i/status/${post.xPostId}` : undefined,
        },
        { status: 400 }
      );
    }

    if (!post.translatedSummary && !customContent.text) {
      return NextResponse.json(
        { error: "Post is missing translated summary" },
        { status: 400 }
      );
    }

    // Start tracking this attempt (manual retry)
    const { attempts } = await startPublishingAttempt(id, { isManualRetry: true });
    console.log(`Manual publish attempt ${attempts} for post ${id} (previous attempts: ${xPublication?.attempts || 0})`);

    try {
      // Use custom text if provided, otherwise auto-generate
      const tweetText = customContent.text || formatTweetContent({
        translatedTitle: post.translatedTitle,
        translatedSummary: post.translatedSummary!,
        categories: post.categories,
        source: post.source,
        sourceUrl: post.sourceUrl,
      });

      // Try to attach an image
      let mediaIds: string[] | undefined;
      let mediaId: string | undefined;
      let imageSource: ImageSource = ImageSource.NONE;

      // Build ordered list of candidate image URLs to try
      const candidateImages: { url: string; source: ImageSource }[] = [];

      if (customContent.imageUrl) {
        // Custom image takes top priority
        candidateImages.push({ url: customContent.imageUrl, source: ImageSource.SCRAPED });
      } else {
        // Priority 1: cardImageUrl (AI-generated or good-ratio original)
        if (post.cardImageUrl) {
          const isOriginal = post.originalMediaUrls?.includes(post.cardImageUrl);
          candidateImages.push({
            url: post.cardImageUrl,
            source: isOriginal ? ImageSource.SCRAPED : ImageSource.AI_GENERATED,
          });
        }

        // Priority 2: originalMediaUrls (scraped images)
        if (post.originalMediaUrls && post.originalMediaUrls.length > 0) {
          for (const url of post.originalMediaUrls) {
            if (url !== post.cardImageUrl) {
              candidateImages.push({ url, source: ImageSource.SCRAPED });
            }
          }
        }
      }

      // Try each candidate image URL
      for (const candidate of candidateImages) {
        try {
          console.log(`Trying image for post ${post.id}: ${candidate.url} (${candidate.source})`);
          mediaId = await uploadMedia(candidate.url);
          mediaIds = [mediaId];
          imageSource = candidate.source;
          console.log(`Image uploaded for post ${post.id}, media_id: ${mediaId}`);
          break; // Success
        } catch (imgErr) {
          console.error(`Image upload failed for post ${post.id} (${candidate.url}):`, imgErr);
          // Continue to next candidate
        }
      }

      // Fallback: Generate AI image if no existing image worked
      if (!mediaIds && !customContent.imageUrl) {
        try {
          console.log(`No existing image worked for post ${post.id}, generating AI image...`);
          const aiImageUrl = await generatePostImage(
            post.translatedTitle || post.originalTitle || "EV News",
            post.translatedSummary!,
            { source: "manual_post_to_x", postId: post.id }
          );
          if (aiImageUrl) {
            mediaId = await uploadMedia(aiImageUrl);
            mediaIds = [mediaId];
            imageSource = ImageSource.AI_GENERATED;
            console.log(`AI image uploaded for post ${post.id}, media_id: ${mediaId}`);
          }
        } catch (aiImgErr) {
          console.error(`AI image generation/upload failed for post ${post.id}:`, aiImgErr);
          imageSource = ImageSource.FAILED;
        }
      } else if (!mediaIds && customContent.imageUrl) {
        imageSource = ImageSource.FAILED;
      }

      const tweetResponse = await postTweet(tweetText, mediaIds);

      // Record success in XPublication
      await recordPublishSuccess(id, {
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
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        tweetId: tweetResponse.data.id,
        tweetUrl: `https://x.com/i/status/${tweetResponse.data.id}`,
        hasImage: !!mediaIds,
        imageSource: imageSource.toLowerCase(),
        attempts,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record failure in XPublication
      const { attempts: totalAttempts, maxReached } = await recordPublishFailure(id, errorMessage);

      console.error(`Error posting to X (attempt ${totalAttempts}):`, error);
      return NextResponse.json(
        {
          error: `Failed to post to X: ${errorMessage}`,
          attempts: totalAttempts,
          maxAttempts: MAX_ATTEMPTS,
          maxReached,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error posting to X:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to post to X: ${errorMessage}` },
      { status: 500 }
    );
  }
}
