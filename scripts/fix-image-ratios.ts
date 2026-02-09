/**
 * Batch migration script to fix existing posts with bad image aspect ratios
 *
 * This script:
 * 1. Queries all posts with originalMediaUrls
 * 2. Checks each image's aspect ratio
 * 3. For posts with bad ratios: generates new AI image and updates database
 *
 * Usage: npx tsx scripts/fix-image-ratios.ts
 *
 * Environment variables required:
 * - DATABASE_URL
 * - TOGETHER_API_KEY (primary - FLUX.1, cheaper)
 * - OPENAI_API_KEY (fallback - DALL-E 3)
 * - BLOB_READ_WRITE_TOKEN
 */

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import OpenAI from "openai";

const prisma = new PrismaClient();

// Image generation costs
const FLUX_COST = 0.01; // Together AI FLUX.1-dev
const DALLE_COST = 0.08; // DALL-E 3 1792x1024 standard

// Minimum acceptable aspect ratio (width/height) - 0.75 allows 4:3 portrait images
const MIN_RATIO = 0.75;

// Maximum number of posts to generate AI images for (cost control)
const GENERATE_LIMIT = 10;

// For dry run mode - set to true to just report without making changes
const DRY_RUN = process.argv.includes("--dry-run");

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from a URL
 */
async function getImageDimensions(
  url: string
): Promise<ImageDimensions | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-65535" },
    });

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return parseImageDimensions(buffer);
  } catch {
    return null;
  }
}

/**
 * Parse image dimensions from buffer
 */
function parseImageDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height };
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      if (marker >= 0xd0 && marker <= 0xd9) {
        offset += 2;
      } else if (offset + 4 <= buffer.length) {
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        break;
      }
    }
  }

  return null;
}

/**
 * Check if aspect ratio is acceptable
 */
function isAcceptableRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return ratio >= MIN_RATIO && ratio <= 4;
}

/**
 * Track AI usage in database
 */
async function trackAIUsage(params: {
  type: string;
  model: string;
  size?: string;
  cost: number;
  success: boolean;
  errorMsg?: string;
  postId?: string;
  source: string;
}): Promise<void> {
  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    console.error("Failed to track AI usage:", error);
  }
}

/**
 * Generate AI image using Together AI (FLUX.1)
 */
async function generateWithTogetherAI(
  prompt: string,
  postId: string
): Promise<string> {
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (!togetherKey) {
    throw new Error("TOGETHER_API_KEY not configured");
  }

  const response = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${togetherKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-dev",
      prompt,
      width: 1792,
      height: 1024,
      n: 1,
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Together AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error("Together AI: no image URL returned");
  }

  // Track successful generation
  await trackAIUsage({
    type: "image_generation",
    model: "FLUX.1-dev",
    size: "1792x1024",
    cost: FLUX_COST,
    success: true,
    postId,
    source: "migration_script",
  });

  return imageUrl;
}

/**
 * Generate AI image using DALL-E 3 (fallback)
 */
async function generateWithDALLE(
  prompt: string,
  postId: string
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1792x1024",
    quality: "standard",
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("DALL-E: no image URL returned");
  }

  // Track successful generation
  await trackAIUsage({
    type: "image_generation",
    model: "dall-e-3",
    size: "1792x1024",
    cost: DALLE_COST,
    success: true,
    postId,
    source: "migration_script",
  });

  return imageUrl;
}

/**
 * Generate AI image - tries Together AI (FLUX.1) first, falls back to DALL-E 3
 */
async function generateImage(
  title: string,
  summary: string,
  postId: string
): Promise<string> {
  const imagePrompt = `A professional, modern photograph style image for an electric vehicle news article.
Topic: ${title}
Context: ${summary.slice(0, 200)}

Style requirements:
- Clean, professional news/tech media aesthetic
- Feature electric vehicles, charging infrastructure, or EV technology
- Modern urban or tech environment
- Vibrant but realistic colors
- No text or logos in the image
- High quality, suitable for social media`;

  // Try Together AI (FLUX.1) first - 96% cheaper
  if (process.env.TOGETHER_API_KEY) {
    try {
      const url = await generateWithTogetherAI(imagePrompt, postId);
      console.log(`  Using FLUX.1 (cost: $${FLUX_COST})`);
      return url;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.warn(`  Together AI failed: ${errorMsg}, trying DALL-E...`);

      await trackAIUsage({
        type: "image_generation",
        model: "FLUX.1-dev",
        size: "1792x1024",
        cost: 0,
        success: false,
        errorMsg,
        postId,
        source: "migration_script",
      });
    }
  }

  // Fallback to DALL-E 3
  if (process.env.OPENAI_API_KEY) {
    try {
      const url = await generateWithDALLE(imagePrompt, postId);
      console.log(`  Using DALL-E 3 (cost: $${DALLE_COST})`);
      return url;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      await trackAIUsage({
        type: "image_generation",
        model: "dall-e-3",
        size: "1792x1024",
        cost: 0,
        success: false,
        errorMsg,
        postId,
        source: "migration_script",
      });

      throw error;
    }
  }

  // No API keys configured
  const error = "No image generation API configured (need TOGETHER_API_KEY or OPENAI_API_KEY)";
  await trackAIUsage({
    type: "image_generation",
    model: "none",
    cost: 0,
    success: false,
    errorMsg: error,
    postId,
    source: "migration_script",
  });
  throw new Error(error);
}

/**
 * Main migration function
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Image Aspect Ratio Migration Script");
  console.log("=".repeat(60));
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`Minimum acceptable ratio: ${MIN_RATIO}:1`);
  console.log(`AI generation limit: ${GENERATE_LIMIT} posts (highest relevanceScore)`);
  console.log(`Remaining bad images: will be cleared to show placeholder`);
  console.log("");

  // Get all posts with images, ordered by relevanceScore (highest first)
  // This ensures the most relevant posts get AI-generated images
  const posts = await prisma.post.findMany({
    where: {
      originalMediaUrls: {
        isEmpty: false,
      },
    },
    select: {
      id: true,
      translatedTitle: true,
      originalTitle: true,
      translatedSummary: true,
      originalMediaUrls: true,
      relevanceScore: true,
      status: true,
    },
    orderBy: {
      relevanceScore: "desc",
    },
  });

  console.log(`Found ${posts.length} posts with images to check`);
  console.log("");

  const results = {
    checked: 0,
    acceptable: 0,
    badRatio: 0,
    fixed: 0,
    cleared: 0,
    errors: 0,
    skipped: 0,
  };

  for (const post of posts) {
    results.checked++;
    const mediaUrls = post.originalMediaUrls as string[];

    if (!mediaUrls || mediaUrls.length === 0) {
      results.skipped++;
      continue;
    }

    const imageUrl = mediaUrls[0];
    console.log(`[${results.checked}/${posts.length}] Post ${post.id}`);
    console.log(`  Title: ${(post.translatedTitle || post.originalTitle || "").slice(0, 50)}...`);

    // Check dimensions
    const dimensions = await getImageDimensions(imageUrl);

    if (!dimensions) {
      console.log("  Status: Could not read dimensions, skipping");
      results.skipped++;
      continue;
    }

    const ratio = dimensions.width / dimensions.height;
    console.log(
      `  Dimensions: ${dimensions.width}x${dimensions.height} (ratio: ${ratio.toFixed(2)})`
    );

    if (isAcceptableRatio(dimensions.width, dimensions.height)) {
      console.log("  Status: OK (acceptable ratio)");
      results.acceptable++;
      continue;
    }

    console.log(`  Status: BAD RATIO (relevanceScore: ${post.relevanceScore ?? "null"})`);
    results.badRatio++;

    if (DRY_RUN) {
      if (results.fixed < GENERATE_LIMIT) {
        console.log(`  Action: Would regenerate AI image (${results.fixed + 1}/${GENERATE_LIMIT})`);
        results.fixed++;
      } else {
        console.log("  Action: Would clear image (use placeholder)");
        results.cleared++;
      }
      continue;
    }

    // Check if we've reached the generation limit
    if (results.fixed >= GENERATE_LIMIT) {
      // Clear the bad image so placeholder shows
      try {
        console.log("  Clearing image to use placeholder...");
        await prisma.post.update({
          where: { id: post.id },
          data: {
            originalMediaUrls: [],
            updatedAt: new Date(),
          },
        });
        console.log("  Done! Will show placeholder.");
        results.cleared++;
      } catch (error) {
        console.error(`  Error clearing image: ${error}`);
        results.errors++;
      }
      console.log("");
      continue;
    }

    // Generate new image for top posts
    try {
      const title =
        post.translatedTitle || post.originalTitle || "EV News";
      const summary = post.translatedSummary || "";

      console.log(`  Generating new AI image (${results.fixed + 1}/${GENERATE_LIMIT})...`);
      const newImageUrl = await generateImage(title, summary, post.id);

      // Upload to Vercel Blob
      console.log("  Uploading to Vercel Blob...");
      const imageResponse = await fetch(newImageUrl);
      const imageBlob = await imageResponse.blob();
      const { url: blobUrl } = await put(`posts/${post.id}.png`, imageBlob, {
        access: "public",
      });

      // Update database
      console.log("  Updating database...");
      await prisma.post.update({
        where: { id: post.id },
        data: {
          originalMediaUrls: [blobUrl],
          updatedAt: new Date(),
        },
      });

      console.log(`  Done! New image: ${blobUrl}`);
      results.fixed++;
    } catch (error) {
      console.error(`  Error: ${error}`);
      results.errors++;
    }

    console.log("");
  }

  // Summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Migration Complete");
  console.log("=".repeat(60));
  console.log(`Total checked: ${results.checked}`);
  console.log(`Acceptable ratio: ${results.acceptable}`);
  console.log(`Bad ratio found: ${results.badRatio}`);
  console.log(`AI images generated: ${results.fixed}`);
  console.log(`Cleared (using placeholder): ${results.cleared}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Skipped: ${results.skipped}`);

  if (DRY_RUN && results.badRatio > 0) {
    console.log("");
    console.log(
      `Run without --dry-run to fix images. Cost estimate: ~$${(results.fixed * 0.08).toFixed(2)} (${results.fixed} AI generations)`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
