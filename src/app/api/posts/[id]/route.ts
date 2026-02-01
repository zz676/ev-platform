import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang") || "en";

    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Transform based on language
    const transformedPost = {
      id: post.id,
      sourceId: post.sourceId,
      source: post.source,
      sourceUrl: post.sourceUrl,
      author: post.sourceAuthor,
      date: post.sourceDate,
      title: lang === "zh" ? post.originalTitle : post.translatedTitle,
      content:
        lang === "zh" ? post.originalContent : post.translatedContent || "",
      summary: post.translatedSummary,
      mediaUrls: post.originalMediaUrls,
      categories: post.categories,
      relevanceScore: post.relevanceScore,
      status: post.status,
      publishedToX: post.publishedToX,
      xPostId: post.xPostId,
      xPublishedAt: post.xPublishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    return NextResponse.json({ post: transformedPost });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}
