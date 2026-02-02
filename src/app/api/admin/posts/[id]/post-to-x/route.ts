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

    if (!post.translatedSummary) {
      return NextResponse.json(
        { error: "Post is missing translated summary" },
        { status: 400 }
      );
    }

    // Start tracking this attempt (manual retry)
    const { attempts } = await startPublishingAttempt(id, { isManualRetry: true });
    console.log(`Manual publish attempt ${attempts} for post ${id} (previous attempts: ${xPublication?.attempts || 0})`);

    try {
      const tweetText = formatTweetContent({
        translatedTitle: post.translatedTitle,
        translatedSummary: post.translatedSummary,
        categories: post.categories,
        source: post.source,
        sourceUrl: post.sourceUrl,
      });

      // Try to attach an image
      let mediaIds: string[] | undefined;
      let mediaId: string | undefined;
      let imageSource: ImageSource = ImageSource.NONE;

      try {
        let imageUrl: string | undefined;

        if (post.originalMediaUrls && post.originalMediaUrls.length > 0) {
          imageUrl = post.originalMediaUrls[0];
          imageSource = ImageSource.SCRAPED;
        } else {
          imageUrl = await generatePostImage(
            post.translatedTitle || post.originalTitle || "EV News",
            post.translatedSummary
          );
          if (imageUrl) {
            imageSource = ImageSource.AI_GENERATED;
          }
        }

        if (imageUrl) {
          mediaId = await uploadMedia(imageUrl);
          mediaIds = [mediaId];
        }
      } catch (imageError) {
        console.error(`Image processing failed for post ${post.id}:`, imageError);
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
