import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/auth/api-auth";

async function digestImageUrlColumnExists(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'DigestContent'
          AND column_name = 'digestImageUrl'
      ) as "exists"
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    // If introspection fails for any reason, fall back to "doesn't exist" to keep the endpoint working.
    return false;
  }
}

async function getDigestSelect() {
  const includeDigestImageUrl = await digestImageUrlColumnExists();
  return {
    id: true,
    scheduledFor: true,
    content: true,
    postIds: true,
    topPostId: true,
    status: true,
    postedAt: true,
    tweetId: true,
    createdAt: true,
    ...(includeDigestImageUrl ? { digestImageUrl: true } : {}),
  } as const;
}

// GET: List digest entries with optional status filter
export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // PENDING, POSTED, FAILED
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build where clause
    const where = status ? { status } : {};

    const digestSelect = await getDigestSelect();

    const [digests, total] = await Promise.all([
      prisma.digestContent.findMany({
        where,
        orderBy: { scheduledFor: "desc" },
        skip,
        take: limit,
        select: digestSelect,
      }),
      prisma.digestContent.count({ where }),
    ]);

    // Get stats for all statuses
    const statusStats = await prisma.digestContent.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const stats = {
      pending: 0,
      posted: 0,
      failed: 0,
      total: 0,
    };

    statusStats.forEach((stat) => {
      const count = stat._count.id;
      stats.total += count;
      switch (stat.status) {
        case "PENDING":
          stats.pending = count;
          break;
        case "POSTED":
          stats.posted = count;
          break;
        case "FAILED":
          stats.failed = count;
          break;
      }
    });

    return NextResponse.json({
      digests,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching digests:", error);
    return NextResponse.json(
      { error: "Failed to fetch digests" },
      { status: 500 }
    );
  }
}

// PATCH: Update a digest entry
export async function PATCH(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { id, content } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Digest ID is required" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const digestSelect = await getDigestSelect();

    // Check if digest exists
    const digest = await prisma.digestContent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!digest) {
      return NextResponse.json(
        { error: "Digest not found" },
        { status: 404 }
      );
    }

    // Update the digest
    const updatedDigest = await prisma.digestContent.update({
      where: { id },
      data: { content: content.trim() },
      select: digestSelect,
    });

    return NextResponse.json({
      success: true,
      digest: updatedDigest,
    });
  } catch (error) {
    console.error("Error updating digest:", error);
    return NextResponse.json(
      { error: "Failed to update digest" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a digest entry
export async function DELETE(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Digest ID is required" },
        { status: 400 }
      );
    }

    // Check if digest exists
    const digest = await prisma.digestContent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!digest) {
      return NextResponse.json(
        { error: "Digest not found" },
        { status: 404 }
      );
    }

    // Delete the digest
    await prisma.digestContent.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Digest deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting digest:", error);
    return NextResponse.json(
      { error: "Failed to delete digest" },
      { status: 500 }
    );
  }
}
