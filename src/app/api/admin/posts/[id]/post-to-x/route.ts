import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { postTweet, formatTweetContent, uploadMedia } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";

// POST: Manually post an approved post to X
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the post
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Validate post is approved
    if (post.status !== PostStatus.APPROVED && post.status !== PostStatus.PUBLISHED) {
      return NextResponse.json(
        { error: "Post must be approved before posting to X" },
        { status: 400 }
      );
    }

    // Check if already published to X
    if (post.publishedToX) {
      return NextResponse.json(
        {
          error: "Post already published to X",
          tweetUrl: `https://x.com/i/status/${post.xPostId}`
        },
        { status: 400 }
      );
    }

    // Validate required content
    if (!post.translatedSummary) {
      return NextResponse.json(
        { error: "Post is missing translated summary" },
        { status: 400 }
      );
    }

    // Format tweet content
    const tweetText = formatTweetContent({
      translatedTitle: post.translatedTitle,
      translatedSummary: post.translatedSummary,
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
          post.translatedSummary
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
        updatedAt: new Date(),
      },
    });

    const tweetUrl = `https://x.com/i/status/${tweetResponse.data.id}`;

    return NextResponse.json({
      success: true,
      tweetId: tweetResponse.data.id,
      tweetUrl,
      hasImage: !!mediaIds,
      imageSource,
    });
  } catch (error) {
    console.error("Error posting to X:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to post to X: ${errorMessage}` },
      { status: 500 }
    );
  }
}
