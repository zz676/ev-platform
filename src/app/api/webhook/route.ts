import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Source, PostStatus } from "@prisma/client";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { generatePostImage } from "@/lib/ai";
import { POSTING_CONFIG } from "@/lib/config/posting";
import { checkImageRatio, parseImageDataUrl } from "@/lib/image-utils";

// Webhook secret for authenticating scraper requests
const WEBHOOK_SECRET = process.env.SCRAPER_WEBHOOK_SECRET;

function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

// Schema for incoming post data from scraper
const postDataSchema = z.object({
  sourceId: z.string().min(1, "Source ID required"),
  source: z.enum(["OFFICIAL", "MEDIA", "WEIBO", "MANUAL"]),
  sourceUrl: z.string().url("Valid URL required"),
  sourceAuthor: z.string().min(1, "Author required"),
  sourceDate: z.string().transform((val) => new Date(val)),
  originalTitle: z.string().optional(),
  originalContent: z.string().min(1, "Content required"),
  originalMediaUrls: z.array(z.string().url()).optional().default([]),
  translatedTitle: z.string().optional(),
  translatedContent: z.string().optional(),
  translatedSummary: z.string().optional(),
  categories: z.array(z.string()).optional().default([]),
  relevanceScore: z.number().int().min(0).max(100).optional().default(50),
});

const webhookPayloadSchema = z.object({
  posts: z.array(postDataSchema),
  batchId: z.string().optional(),
});

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("SCRAPER_WEBHOOK_SECRET not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature") || "";

    // Verify signature in production
    if (process.env.NODE_ENV === "production") {
      if (!verifySignature(rawBody, signature)) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 }
        );
      }
    }

    // Parse and validate payload
    const payload = JSON.parse(rawBody);
    const validation = webhookPayloadSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { posts, batchId } = validation.data;

    // Process posts
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const postData of posts) {
      try {
        // Check if post exists
        const existing = await prisma.post.findUnique({
          where: { sourceId: postData.sourceId },
        });

        if (existing) {
          // Update if content changed
          if (
            existing.originalContent !== postData.originalContent ||
            existing.translatedContent !== postData.translatedContent
          ) {
            await prisma.post.update({
              where: { sourceId: postData.sourceId },
              data: {
                originalTitle: postData.originalTitle,
                originalContent: postData.originalContent,
                originalMediaUrls: postData.originalMediaUrls,
                translatedTitle: postData.translatedTitle,
                translatedContent: postData.translatedContent || "",
                translatedSummary: postData.translatedSummary || "",
                categories: postData.categories,
                relevanceScore: postData.relevanceScore,
                updatedAt: new Date(),
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new post
          const postId = generateId();
          const originalMediaUrls = postData.originalMediaUrls;
          let cardImageUrl: string | null = null;
          let needsImageGeneration = false;

          // Check if we need AI image generation for card display
          if (!originalMediaUrls || originalMediaUrls.length === 0) {
            needsImageGeneration = true;
          } else {
            // Check if scraped image has acceptable aspect ratio (minimum 0.75:1 to allow portrait images)
            const firstImageUrl = originalMediaUrls[0];
            const isAcceptable = await checkImageRatio(firstImageUrl, 0.75);
            if (isAcceptable === false) {
              console.log(
                `Scraped image has bad aspect ratio for post ${postId}, will use placeholder in cards`
              );
              needsImageGeneration = true;
              // cardImageUrl stays null - placeholder will be used in cards
              // originalMediaUrls preserved for article detail page
            } else if (isAcceptable === null) {
              console.log(
                `Could not check image dimensions for post ${postId}, using original for cards`
              );
              cardImageUrl = firstImageUrl; // Use original if we can't check
            } else {
              // Good ratio - use original image for cards too
              cardImageUrl = firstImageUrl;
            }
          }

          // Auto-approve if relevanceScore >= MIN_RELEVANCE_SCORE
          const shouldAutoApprove =
            postData.relevanceScore >= POSTING_CONFIG.MIN_RELEVANCE_SCORE;

          // Only generate AI image immediately if:
          // 1. We need image generation AND
          // 2. Post will be auto-approved (high relevance)
          // This saves DALL-E costs for posts that may never be approved
          if (needsImageGeneration && shouldAutoApprove) {
            try {
              const title =
                postData.translatedTitle ||
                postData.originalTitle ||
                "EV News";
              const summary = postData.translatedSummary || "";

              // Generate image using DALL-E
              const imageUrl = await generatePostImage(title, summary, {
                source: "webhook",
                postId,
              });

              // If the image is already stored in Vercel Blob (branded overlay), reuse it
              if (imageUrl.includes("public.blob.vercel-storage.com")) {
                cardImageUrl = imageUrl;
              } else {
                // Download and upload to Vercel Blob for permanent storage
                const parsedDataUrl = parseImageDataUrl(imageUrl);
                const imageBlob = parsedDataUrl
                  ? new Blob([parsedDataUrl.buffer], { type: parsedDataUrl.contentType })
                  : await (await fetch(imageUrl)).blob();
                const { url: blobUrl } = await put(
                  `posts/${postId}.png`,
                  imageBlob,
                  { access: "public" }
                );

                cardImageUrl = blobUrl; // Use AI image for cards
              }
              console.log(`AI image generated and stored for post ${postId}`);
            } catch (imageError) {
              console.error(
                `Failed to generate AI image for post ${postId}:`,
                imageError
              );
              // cardImageUrl stays null - placeholder will be used
            }
          }

          await prisma.post.create({
            data: {
              id: postId,
              sourceId: postData.sourceId,
              source: postData.source as Source,
              sourceUrl: postData.sourceUrl,
              sourceAuthor: postData.sourceAuthor,
              sourceDate: postData.sourceDate,
              originalTitle: postData.originalTitle,
              originalContent: postData.originalContent,
              originalMediaUrls: originalMediaUrls, // Always keep original images
              cardImageUrl: cardImageUrl, // AI-generated or good-ratio image for cards
              translatedTitle: postData.translatedTitle,
              translatedContent: postData.translatedContent || "",
              translatedSummary: postData.translatedSummary || "",
              categories: postData.categories,
              relevanceScore: postData.relevanceScore,
              status: shouldAutoApprove ? PostStatus.APPROVED : PostStatus.PENDING,
              approvedAt: shouldAutoApprove ? new Date() : null,
              updatedAt: new Date(),
            },
          });
          results.created++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${postData.sourceId}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      message: "Webhook processed",
      batchId,
      results,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ev-platform-webhook",
    timestamp: new Date().toISOString(),
  });
}
