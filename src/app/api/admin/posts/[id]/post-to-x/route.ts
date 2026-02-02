import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { postTweet, formatTweetContent, uploadMedia } from "@/lib/twitter";
import { generatePostImage } from "@/lib/ai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (post.publishedToX) {
      return NextResponse.json(
        {
          error: "Post already published to X",
          tweetUrl: `https://x.com/i/status/${post.xPostId}`,
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

    const tweetText = formatTweetContent({
      translatedTitle: post.translatedTitle,
      translatedSummary: post.translatedSummary,
      categories: post.categories,
      source: post.source,
      sourceUrl: post.sourceUrl,
    });

    // Try to attach an image
    let mediaIds: string[] | undefined;
    let imageSource: "scraped" | "ai-generated" | "none" | "failed" = "none";

    try {
      let imageUrl: string | undefined;

      if (post.originalMediaUrls && post.originalMediaUrls.length > 0) {
        imageUrl = post.originalMediaUrls[0];
        imageSource = "scraped";
      } else {
        imageUrl = await generatePostImage(
          post.translatedTitle || post.originalTitle || "EV News",
          post.translatedSummary
        );
        if (imageUrl) {
          imageSource = "ai-generated";
        }
      }

      if (imageUrl) {
        const mediaId = await uploadMedia(imageUrl);
        mediaIds = [mediaId];
      }
    } catch (imageError) {
      console.error(`Image processing failed for post ${post.id}:`, imageError);
      imageSource = "failed";
    }

    const tweetResponse = await postTweet(tweetText, mediaIds);

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
