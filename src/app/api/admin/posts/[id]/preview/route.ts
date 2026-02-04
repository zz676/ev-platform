import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { formatTweetContent } from "@/lib/twitter";
import { requireApiAdmin } from "@/lib/auth/api-auth";

export async function GET(
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
        { error: "Post must be approved to preview" },
        { status: 400 }
      );
    }

    // Generate X content
    const xText = post.translatedSummary
      ? formatTweetContent({
          translatedTitle: post.translatedTitle,
          translatedSummary: post.translatedSummary,
          categories: post.categories,
          source: post.source,
          sourceUrl: post.sourceUrl,
        })
      : "";

    // Generate Discord content
    const categoryColors: Record<string, number> = {
      MARKET: 0x3b82f6,
      TECH: 0x8b5cf6,
      TESLA: 0xef4444,
      POLICY: 0x22c55e,
      OTHER: 0x6b7280,
    };
    const category = post.categories[0] || "OTHER";
    const discordColor = categoryColors[category] || categoryColors.OTHER;
    const discordTitle = post.translatedTitle || post.originalTitle || "EV News";
    const discordDescription = post.translatedSummary
      ? post.translatedSummary.length > 300
        ? post.translatedSummary.substring(0, 297) + "..."
        : post.translatedSummary
      : "";

    // Collect available images
    const availableImages: string[] = [];
    if (post.cardImageUrl) {
      availableImages.push(post.cardImageUrl);
    }
    if (post.originalMediaUrls && post.originalMediaUrls.length > 0) {
      for (const url of post.originalMediaUrls) {
        if (!availableImages.includes(url)) {
          availableImages.push(url);
        }
      }
    }

    // Default image
    const imageUrl = availableImages[0] || null;

    return NextResponse.json({
      x: {
        text: xText,
        characterCount: xText.length,
      },
      discord: {
        title: discordTitle,
        description: discordDescription,
        color: discordColor,
        category,
      },
      imageUrl,
      availableImages,
      postDetails: {
        source: post.source,
        sourceUrl: post.sourceUrl,
        publishedToX: post.publishedToX,
        publishedToDiscord: post.publishedToDiscord,
      },
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate preview: ${errorMessage}` },
      { status: 500 }
    );
  }
}
