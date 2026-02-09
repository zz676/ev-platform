import OpenAI from "openai";
import crypto from "crypto";
import path from "path";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";

// Image generation pricing (as of 2024)
const IMAGE_GEN_COST = {
  // Together AI - FLUX.1 models
  "FLUX.1-schnell": 0.003, // Fast, cheap
  "FLUX.1-dev": 0.01,
  "FLUX.1-pro": 0.025,
  // DALL-E 3
  "dall-e-3-1792x1024-standard": 0.08,
  "dall-e-3-1792x1024-hd": 0.12,
  "dall-e-3-1024x1024-standard": 0.04,
} as const;

// Text completion pricing (per 1M tokens, as of 2024)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
} as const;

// Calculate cost for text completion based on token usage
function calculateTextCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = TEXT_COMPLETION_COST[model as keyof typeof TEXT_COMPLETION_COST];
  if (!pricing) {
    console.warn(`Unknown model for pricing: ${model}`);
    return 0;
  }
  // Cost = (input_tokens * input_price + output_tokens * output_price) / 1M
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Track AI usage in database
async function trackAIUsage(params: {
  type: string;
  model: string;
  size?: string;
  cost: number;
  success: boolean;
  errorMsg?: string;
  postId?: string;
  source: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    // Don't fail the main operation if tracking fails
    console.error("Failed to track AI usage:", error);
  }
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(`Together AI attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function applyBrandingOverlay(imageUrl: string): Promise<string> {
  const siteUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL || "https://evjuice.net"
  );
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    console.warn("[AI] BLOB_READ_WRITE_TOKEN missing; skipping branded overlay");
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image for branding: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const { createCanvas, loadImage } = await import("canvas");
  const baseImage = await loadImage(imageBuffer);
  const width = baseImage.width;
  const height = baseImage.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, width, height);

  const bannerHeight = Math.max(Math.round(height * 0.12), 90);
  const bannerY = height - bannerHeight;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, bannerY, width, bannerHeight);

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  let logoImage;
  try {
    const logoBuffer = await import("fs/promises").then((fs) => fs.readFile(logoPath));
    logoImage = await loadImage(logoBuffer);
  } catch (error) {
    console.warn("[AI] Failed to load logo for branding overlay:", error);
  }

  const paddingX = Math.round(width * 0.04);
  const logoSize = Math.round(bannerHeight * 0.55);
  const logoY = bannerY + Math.round((bannerHeight - logoSize) / 2);

  if (logoImage) {
    ctx.drawImage(logoImage, paddingX, logoY, logoSize, logoSize);
  }

  const textX = logoImage ? paddingX + logoSize + Math.round(bannerHeight * 0.3) : paddingX;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = `600 ${Math.round(bannerHeight * 0.32)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(siteUrl, textX, bannerY + bannerHeight / 2);

  const outputBuffer = canvas.toBuffer("image/png");
  const fileName = `generated/brand-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.png`;
  const blob = await put(fileName, outputBuffer, {
    access: "public",
    contentType: "image/png",
  });

  return blob.url;
}

// AI Provider configuration
const providers = [
  {
    name: "deepseek",
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: "deepseek-chat",
  },
  {
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
  },
];

// Get configured AI client (with fallback)
export async function getAIClient(): Promise<{ client: OpenAI; model: string }> {
  for (const provider of providers) {
    if (provider.apiKey) {
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
      });
      return { client, model: provider.model };
    }
  }
  throw new Error("No AI provider configured");
}

// Process EV content with AI
export async function processEVContent(content: string, source: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a professional EV industry analyst and translator. Process the following Chinese EV news content.

Return a JSON object with:
- relevance_score (0-100): News value + uniqueness + timeliness + credibility
- categories (array): Tags like "BYD", "NIO", "Sales", "Technology", "Policy"
- translated_title (string): English title
- translated_content (string): Full English translation
- x_summary (string): Twitter-friendly summary (max 250 chars)
- hashtags (array): Relevant hashtags like "#ChinaEV", "#BYD"

Scoring criteria:
- News Value (30): Important news, data, or announcements
- Uniqueness (25): China-specific perspective
- Timeliness (25): Current/breaking news
- Credibility (20): Source reliability

Translation requirements:
- Use correct terminology: NEV, BEV, PHEV
- Keep brand names: BYD, NIO, XPeng, Li Auto
- Natural English for international readers`,
      },
      {
        role: "user",
        content: `Source: ${source}\n\nContent:\n${content}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "process_content",
    inputTokens,
    outputTokens,
  });

  const result = response.choices[0].message.content;
  return result ? JSON.parse(result) : null;
}

// Translate content only
export async function translateContent(content: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a professional translator specializing in the EV industry. Translate the following Chinese content to English.

Requirements:
- Use correct industry terminology (NEV, BEV, PHEV)
- Keep Chinese brand names (BYD, NIO, XPeng, Li Auto)
- Preserve numbers and statistics accurately
- Make it natural for English readers`,
      },
      {
        role: "user",
        content,
      },
    ],
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "translate",
    inputTokens,
    outputTokens,
  });

  return response.choices[0].message.content;
}

// Generate X post summary
export async function generateXSummary(content: string, postId?: string) {
  const { client, model } = await getAIClient();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `Create a concise, engaging summary for X (Twitter).

Requirements:
- Maximum 250 characters (leave room for hashtags)
- Lead with the most important fact
- Include key numbers if applicable
- Make it engaging but factual`,
      },
      {
        role: "user",
        content,
      },
    ],
  });

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    postId,
    source: "x_summary",
    inputTokens,
    outputTokens,
  });

  return response.choices[0].message.content;
}

// Generate image using Together AI (FLUX.1)
async function generateWithTogetherAI(
  prompt: string,
  options: { source: string; postId?: string }
): Promise<string> {
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (!togetherKey) {
    throw new Error("TOGETHER_API_KEY not configured");
  }

  const model = "black-forest-labs/FLUX.1-dev";
  const cost = IMAGE_GEN_COST["FLUX.1-dev"];

  const response = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${togetherKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
    cost,
    success: true,
    postId: options.postId,
    source: options.source,
  });

  console.log(`FLUX.1 image generated for: ${prompt.slice(0, 50)}... [source: ${options.source}, cost: $${cost}]`);
  return imageUrl;
}

// Generate image using DALL-E 3 (fallback)
async function generateWithDALLE(
  prompt: string,
  options: { source: string; postId?: string }
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const model = "dall-e-3";
  const size = "1792x1024" as const;
  const quality = "standard" as const;
  const cost = IMAGE_GEN_COST["dall-e-3-1792x1024-standard"];

  const openai = new OpenAI({ apiKey: openaiKey });

  const response = await openai.images.generate({
    model,
    prompt,
    n: 1,
    size,
    quality,
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("DALL-E: no image URL returned");
  }

  // Track successful generation
  await trackAIUsage({
    type: "image_generation",
    model: "dall-e-3",
    size,
    cost,
    success: true,
    postId: options.postId,
    source: options.source,
  });

  console.log(`DALL-E 3 image generated for: ${prompt.slice(0, 50)}... [source: ${options.source}, cost: $${cost}]`);
  return imageUrl;
}

// Generate image for X post - tries Together AI (FLUX.1) first, falls back to DALL-E 3
export async function generatePostImage(
  title: string,
  summary: string,
  options?: {
    source?: string;
    postId?: string;
  }
): Promise<string> {
  const source = options?.source || "unknown";
  const postId = options?.postId;

  // Create a prompt that generates relevant EV imagery
  const imagePrompt = `A professional, modern photograph style image for an electric vehicle news article.
Topic: ${title}
Context: ${summary.slice(0, 200)}

Style requirements:
- Clean, professional news/tech media aesthetic
- Feature electric vehicles, charging infrastructure, or EV technology
- Modern urban or tech environment
- Vibrant but realistic colors
- No embedded text or logos in the scene
- Leave a clean, low-detail area near the bottom for branding overlay
- High quality, suitable for social media`;

  let imageUrl: string | null = null;

  // Try Together AI (FLUX.1) first - 96% cheaper
  // Uses retry with exponential backoff (1s, 2s, 4s) for transient errors like HTTP 500
  if (process.env.TOGETHER_API_KEY) {
    try {
      imageUrl = await retryWithBackoff(
        () => generateWithTogetherAI(imagePrompt, { source, postId }),
        3,    // maxRetries
        1000  // baseDelayMs
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.warn(`Together AI failed after all retries, falling back to DALL-E: ${errorMsg}`);

      // Track the failure (after all retries exhausted)
      await trackAIUsage({
        type: "image_generation",
        model: "FLUX.1-dev",
        size: "1792x1024",
        cost: 0,
        success: false,
        errorMsg: `All retries failed: ${errorMsg}`,
        postId,
        source,
      });
    }
  }

  // Fallback to DALL-E 3
  if (!imageUrl && process.env.OPENAI_API_KEY) {
    try {
      imageUrl = await generateWithDALLE(imagePrompt, { source, postId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      // Track the failure
      await trackAIUsage({
        type: "image_generation",
        model: "dall-e-3",
        size: "1792x1024",
        cost: 0,
        success: false,
        errorMsg,
        postId,
        source,
      });

      throw error;
    }
  }

  if (!imageUrl) {
    // No API keys configured
    const error = "No image generation API configured (need TOGETHER_API_KEY or OPENAI_API_KEY)";
    await trackAIUsage({
      type: "image_generation",
      model: "none",
      cost: 0,
      success: false,
      errorMsg: error,
      postId,
      source,
    });
    throw new Error(error);
  }

  try {
    return await applyBrandingOverlay(imageUrl);
  } catch (error) {
    console.warn("[AI] Branding overlay failed, using original image:", error);
    return imageUrl;
  }
}
