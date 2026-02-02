import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { requireApiAdmin } from "@/lib/auth/api-auth";

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

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          status: status as "PENDING" | "APPROVED" | "PUBLISHED" | "REJECTED",
        },
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
        },
        orderBy: [
          { relevanceScore: "desc" },
          { sourceDate: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.post.count({
        where: {
          status: status as "PENDING" | "APPROVED" | "PUBLISHED" | "REJECTED",
        },
      }),
    ]);

    // Get stats for all statuses
    const stats = await prisma.post.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const statsMap = {
      total: 0,
      pending: 0,
      approved: 0,
      published: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
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
