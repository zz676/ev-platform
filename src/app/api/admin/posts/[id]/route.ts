import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { generatePostImage } from "@/lib/ai";
import { put } from "@vercel/blob";
import { checkImageRatio } from "@/lib/image-utils";

// PATCH: Update single post status
export async function PATCH(
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
    const body = await request.json();
    const { status } = body;

    if (!["APPROVED", "REJECTED", "PENDING", "PUBLISHED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // First get the current post to check if it needs image generation
    const currentPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        originalMediaUrls: true,
        cardImageUrl: true,
        translatedTitle: true,
        originalTitle: true,
        translatedSummary: true,
      },
    });

    if (!currentPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if we need to generate a card image when approving
    let newCardImageUrl: string | null | undefined;
    if (status === "APPROVED" && !currentPost.cardImageUrl) {
      const mediaUrls = currentPost.originalMediaUrls as string[];
      let needsImageGeneration = false;

      if (!mediaUrls || mediaUrls.length === 0) {
        needsImageGeneration = true;
      } else {
        // Check if existing image has bad aspect ratio
        const isAcceptable = await checkImageRatio(mediaUrls[0], 1.3);
        if (isAcceptable === false) {
          needsImageGeneration = true;
          console.log(`Post ${id} has bad image ratio, generating card image`);
        } else if (isAcceptable === true) {
          // Good ratio - use original for cards
          newCardImageUrl = mediaUrls[0];
        }
      }

      if (needsImageGeneration) {
        try {
          const title =
            currentPost.translatedTitle ||
            currentPost.originalTitle ||
            "EV News";
          const summary = currentPost.translatedSummary || "";

          // Generate image using DALL-E
          const imageUrl = await generatePostImage(title, summary, {
            source: "admin_approve",
            postId: id,
          });

          // Download and upload to Vercel Blob for permanent storage
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          const { url: blobUrl } = await put(`posts/${id}.png`, imageBlob, {
            access: "public",
          });

          newCardImageUrl = blobUrl;
          console.log(`AI card image generated on approval for post ${id}`);
        } catch (imageError) {
          console.error(
            `Failed to generate AI card image on approval for post ${id}:`,
            imageError
          );
          // cardImageUrl stays null - placeholder will be used
        }
      }
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
        ...(newCardImageUrl !== undefined && { cardImageUrl: newCardImageUrl }),
        ...(status === "APPROVED" && { approvedAt: new Date() }),
      },
      select: {
        id: true,
        status: true,
        translatedTitle: true,
        originalTitle: true,
        originalMediaUrls: true,
        cardImageUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      post,
      imageGenerated: !!newCardImageUrl,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

// GET: Get single post details
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
      include: {
        PostContent: true,
        PostTranslation: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}
