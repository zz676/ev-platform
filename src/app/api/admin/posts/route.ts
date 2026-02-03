import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XPublishStatus, Prisma } from "@prisma/client";
import crypto from "crypto";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { MAX_ATTEMPTS } from "@/lib/x-publication";

// POST: Create a new manual post
export async function POST(request: Request) {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const {
      title,
      content,
      summary,
      sourceUrl,
      sourceAuthor,
      sourceDate,
      brand,
      topics,
      categories,
      relevanceScore,
      status,
      imageUrls,
    } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }
    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Generate IDs
    const id = crypto.randomBytes(12).toString("hex");
    const sourceId = `manual-${Date.now()}`;
    const now = new Date();
    const postDate = sourceDate ? new Date(sourceDate) : now;

    // Create the post
    const post = await prisma.post.create({
      data: {
        id,
        sourceId,
        source: "MANUAL",
        sourceUrl: sourceUrl || "",
        sourceAuthor: sourceAuthor || "EVJuice",
        sourceDate: postDate,
        originalTitle: title,
        originalContent: content,
        originalMediaUrls: imageUrls || [],
        translatedTitle: title,
        translatedContent: content,
        translatedSummary: summary || title.slice(0, 250),
        categories: categories || [],
        topics: topics || [],
        brand: brand || "INDUSTRY",
        relevanceScore: relevanceScore ?? 50,
        status: status || "APPROVED",
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

// GET: List pending posts with pagination
export async function GET(request: Request) {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "PENDING";
    const xStatus = searchParams.get("xStatus"); // Filter by X publication status
    const search = searchParams.get("search")?.trim(); // Search query
    const sortBy = searchParams.get("sortBy") || "relevanceScore"; // Sort column
    const sortOrder = searchParams.get("sortOrder") || "desc"; // Sort direction

    const skip = (page - 1) * limit;

    // Build orderBy based on sort parameters
    const validSortColumns = ["sourceDate", "createdAt", "relevanceScore", "source"];
    const orderByColumn = validSortColumns.includes(sortBy) ? sortBy : "relevanceScore";
    const orderByDirection = sortOrder === "asc" ? "asc" : "desc";

    const orderBy: Prisma.PostOrderByWithRelationInput[] = [
      { [orderByColumn]: orderByDirection },
    ];
    // Add secondary sort for consistency
    if (orderByColumn !== "sourceDate") {
      orderBy.push({ sourceDate: "desc" });
    }

    // Build the where clause
    const where: Prisma.PostWhereInput = {
      status: status as "PENDING" | "APPROVED" | "PUBLISHED" | "REJECTED",
    };

    // Add search filter if specified
    // Supports: "exact phrase" (with quotes) or multi-word search (without quotes)
    if (search) {
      // Check if search is wrapped in quotes (exact phrase)
      const isExactPhrase = /^["'].*["']$/.test(search);
      const cleanSearch = search.replace(/^["']|["']$/g, "").trim();

      if (isExactPhrase) {
        // Exact phrase: search for the exact substring
        where.OR = [
          { translatedTitle: { contains: cleanSearch, mode: "insensitive" } },
          { originalTitle: { contains: cleanSearch, mode: "insensitive" } },
        ];
      } else {
        // Multi-word: ALL terms must appear in at least one title
        const searchTerms = cleanSearch.split(/\s+/).filter(term => term.length > 0);

        if (searchTerms.length === 1) {
          where.OR = [
            { translatedTitle: { contains: searchTerms[0], mode: "insensitive" } },
            { originalTitle: { contains: searchTerms[0], mode: "insensitive" } },
          ];
        } else {
          // Each term must appear in either title
          where.AND = searchTerms.map(term => ({
            OR: [
              { translatedTitle: { contains: term, mode: "insensitive" } },
              { originalTitle: { contains: term, mode: "insensitive" } },
            ],
          }));
        }
      }
    }

    // Add X status filter if specified
    if (xStatus === "failed") {
      where.XPublication = {
        status: XPublishStatus.FAILED,
      };
    } else if (xStatus === "published") {
      where.XPublication = {
        status: XPublishStatus.PUBLISHED,
      };
    } else if (xStatus === "not_posted") {
      where.XPublication = null;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          translatedTitle: true,
          originalTitle: true,
          source: true,
          sourceUrl: true,
          sourceDate: true,
          relevanceScore: true,
          status: true,
          createdAt: true,
          publishedToX: true,
          xPostId: true,
          XPublication: {
            select: {
              status: true,
              attempts: true,
              lastError: true,
              tweetId: true,
              tweetUrl: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Get stats for all statuses
    const [statusStats, xFailedCount] = await Promise.all([
      prisma.post.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
      }),
      // Count posts with failed X publications
      prisma.xPublication.count({
        where: {
          status: XPublishStatus.FAILED,
        },
      }),
    ]);

    const statsMap = {
      total: 0,
      pending: 0,
      approved: 0,
      published: 0,
      rejected: 0,
      xFailed: xFailedCount,
    };

    statusStats.forEach((stat) => {
      const count = stat._count.id;
      statsMap.total += count;
      switch (stat.status) {
        case "PENDING":
          statsMap.pending = count;
          break;
        case "APPROVED":
          statsMap.approved = count;
          break;
        case "PUBLISHED":
          statsMap.published = count;
          break;
        case "REJECTED":
          statsMap.rejected = count;
          break;
      }
    });

    return NextResponse.json({
      posts,
      stats: statsMap,
      maxXAttempts: MAX_ATTEMPTS,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

// PATCH: Bulk update posts
export async function PATCH(request: Request) {
  // Require admin authentication
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No post IDs provided" },
        { status: 400 }
      );
    }

    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const result = await prisma.post.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error("Error updating posts:", error);
    return NextResponse.json(
      { error: "Failed to update posts" },
      { status: 500 }
    );
  }
}
