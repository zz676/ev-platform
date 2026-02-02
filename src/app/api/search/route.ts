import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const lang = searchParams.get("lang") || "en";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ posts: [], query: "" });
    }

    const searchTerm = query.trim();

    // Build OR conditions for searching across multiple fields
    const searchConditions: Prisma.PostWhereInput[] = [
      { translatedTitle: { contains: searchTerm, mode: "insensitive" } },
      { translatedContent: { contains: searchTerm, mode: "insensitive" } },
      { originalTitle: { contains: searchTerm, mode: "insensitive" } },
      { originalContent: { contains: searchTerm, mode: "insensitive" } },
    ];

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          { status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] } },
          { OR: searchConditions },
        ],
      },
      orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        source: true,
        sourceUrl: true,
        sourceAuthor: true,
        sourceDate: true,
        originalTitle: true,
        originalContent: true,
        translatedTitle: true,
        translatedContent: true,
        translatedSummary: true,
        originalMediaUrls: true,
        categories: true,
        relevanceScore: true,
        createdAt: true,
      },
    });

    // Transform posts based on language
    const transformedPosts = posts.map((post) => ({
      id: post.id,
      source: post.source,
      sourceUrl: post.sourceUrl,
      author: post.sourceAuthor,
      date: post.sourceDate,
      title: lang === "zh" ? post.originalTitle : post.translatedTitle,
      summary: post.translatedSummary,
      mediaUrls: post.originalMediaUrls,
      categories: post.categories,
      relevanceScore: post.relevanceScore,
      createdAt: post.createdAt,
    }));

    return NextResponse.json({
      posts: transformedPosts,
      query: searchTerm,
      count: transformedPosts.length,
    });
  } catch (error) {
    console.error("Error searching posts:", error);
    return NextResponse.json(
      { error: "Failed to search posts" },
      { status: 500 }
    );
  }
}
