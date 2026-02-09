import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PostStatus, Source } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination - supports both page-based and skip-based
    const limit = parseInt(searchParams.get("limit") || "10");
    const skipParam = searchParams.get("skip");
    const page = parseInt(searchParams.get("page") || "1");
    // Use explicit skip if provided, otherwise calculate from page
    const skip = skipParam ? parseInt(skipParam) : (page - 1) * limit;

    // Filters
    const status = searchParams.get("status") as PostStatus | null;
    const source = searchParams.get("source") as Source | null;
    const category = searchParams.get("category");
    const lang = searchParams.get("lang") || "en";
    const compact = searchParams.get("compact") === "1";
    const includeTotal = searchParams.get("includeTotal") === "1";

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    } else {
      // Default to showing only approved/published posts
      where.status = { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] };
    }

    if (source) {
      where.source = source;
    }

    if (category) {
      where.categories = { has: category };
    }

    const compactSelect = {
      id: true,
      sourceAuthor: true,
      sourceDate: true,
      originalTitle: true,
      translatedTitle: true,
      originalMediaUrls: true,
      cardImageUrl: true,
      categories: true,
      relevanceScore: true,
    };

    const fullSelect = {
      id: true,
      sourceId: true,
      source: true,
      sourceUrl: true,
      sourceAuthor: true,
      sourceDate: true,
      originalTitle: lang === "zh" ? true : false,
      originalContent: lang === "zh" ? true : false,
      translatedTitle: true,
      translatedContent: lang === "en" ? true : false,
      translatedSummary: true,
      originalMediaUrls: true,
      categories: true,
      relevanceScore: true,
      status: true,
      publishedToX: true,
      xPostId: true,
      createdAt: true,
    };

    if (compact) {
      const posts = await prisma.post.findMany({
        where,
        orderBy: { relevanceScore: "desc" },
        skip,
        take: limit,
        select: compactSelect,
      });

      const total = includeTotal ? await prisma.post.count({ where }) : null;
      const totalPages = includeTotal && total !== null ? Math.ceil(total / limit) : null;
      const hasMore = includeTotal && total !== null
        ? skip + posts.length < total
        : posts.length === limit;

      const transformedPosts = posts.map((post) => {
        const title =
          lang === "zh"
            ? post.originalTitle ?? post.translatedTitle
            : post.translatedTitle ?? post.originalTitle;
        return {
          id: post.id,
          title,
          categories: post.categories,
          author: post.sourceAuthor,
          date: post.sourceDate,
          imageUrl: post.cardImageUrl || post.originalMediaUrls?.[0] || null,
          relevanceScore: post.relevanceScore,
        };
      });

      return NextResponse.json(
        {
          posts: transformedPosts,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore,
          },
        },
        {
          headers: {
            "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { relevanceScore: "desc" },
        skip,
        take: limit,
        select: fullSelect,
      }),
      prisma.post.count({ where }),
    ]);

    const transformedPosts = posts.map((post) => ({
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
      createdAt: post.createdAt,
    }));

    return NextResponse.json(
      {
        posts: transformedPosts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + posts.length < total,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
