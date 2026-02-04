import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { postToDiscord, formatDiscordMessage } from "@/lib/discord";
import { requireApiAdmin } from "@/lib/auth/api-auth";

// Request body type for custom content
interface PostToDiscordRequest {
  title?: string;
  description?: string;
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
    let customContent: PostToDiscordRequest = {};
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
        { error: "Post must be approved before posting to Discord" },
        { status: 400 }
      );
    }

    // Check if already posted to Discord
    if (post.publishedToDiscord) {
      return NextResponse.json(
        { error: "Post has already been published to Discord" },
        { status: 400 }
      );
    }

    if (!post.translatedSummary && !customContent.description) {
      return NextResponse.json(
        { error: "Post is missing translated summary" },
        { status: 400 }
      );
    }

    // Build article URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://evjuice.net";
    const articleUrl = `${baseUrl}/en/post/${post.id}`;

    // Use custom content if provided, otherwise use post data
    const title = customContent.title || post.translatedTitle || post.originalTitle || "EV News";
    const summary = customContent.description || post.translatedSummary!;
    const imageUrl = customContent.imageUrl || post.cardImageUrl || post.originalMediaUrls?.[0];

    // Format the Discord message
    const discordPayload = formatDiscordMessage({
      title,
      summary,
      category: post.categories[0] || "OTHER",
      source: post.source,
      sourceUrl: post.sourceUrl,
      articleUrl: articleUrl,
      imageUrl,
    });

    // Post to Discord
    await postToDiscord(discordPayload);

    // Update post in database
    await prisma.post.update({
      where: { id: post.id },
      data: {
        publishedToDiscord: true,
        discordPublishedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Posted to Discord successfully",
    });
  } catch (error) {
    console.error("Error posting to Discord:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to post to Discord: ${errorMessage}` },
      { status: 500 }
    );
  }
}
