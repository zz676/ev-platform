import OpenAI from "openai";
import crypto from "crypto";
import path from "path";
import { put } from "@vercel/blob";
import prisma from "@/lib/prisma";

// Image generation pricing (as of 2025)
const IMAGE_GEN_COST = {
  // GPT Image 1 Mini
  "gpt-image-1-mini-1536x1024-low": 0.006,
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
  // Tests should not attempt to connect to a real database.
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
    return;
  }

  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    // Don't fail the main operation if tracking fails
    console.error("Failed to track AI usage:", error);
  }
}

// Retry helper with exponential backoff

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function applyBrandingOverlay(imageUrl: string): Promise<string> {
  const siteUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL || "https://evjuice.net"
  );
  const siteLabel = "www." + siteUrl.replace(/^https?:\/\//, "");
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  let imageBuffer: Buffer;
  if (imageUrl.startsWith("data:")) {
    // Base64 data URL — decode directly without a network fetch
    const match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid data URL format for branding overlay");
    }
    imageBuffer = Buffer.from(match[1], "base64");
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image for branding: HTTP ${response.status}`);
    }
    imageBuffer = Buffer.from(await response.arrayBuffer());
  }

  const { createCanvas, loadImage } = await import("canvas");
  const baseImage = await loadImage(imageBuffer);
  const width = baseImage.width;
  const height = baseImage.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage, 0, 0, width, height);

  const padding = Math.round(width * 0.03);
  const fontSize = Math.max(Math.round(height * 0.04), 18);

  // Measure text first to compute layout
  ctx.font = `600 ${fontSize}px sans-serif`;
  const textMetrics = ctx.measureText(siteLabel);
  const textWidth = textMetrics.width;

  // Load icon and scale to match text height
  const iconSize = Math.round(fontSize * 1.6);
  const iconGap = 8;
  const totalWidth = iconSize + iconGap + textWidth;

  const iconPath = path.join(process.cwd(), "public", "icon-192.png");
  let iconImage: Awaited<ReturnType<typeof loadImage>> | null = null;
  try {
    iconImage = await loadImage(iconPath);
  } catch {
    console.warn("[AI] Could not load icon-192.png, rendering text-only overlay");
  }

  // Position: right-aligned block at bottom-right
  const blockRight = width - padding;
  const blockLeft = blockRight - totalWidth;
  const textY = height - padding;

  // Draw icon (no shadow)
  if (iconImage) {
    const iconY = textY - iconSize;
    ctx.drawImage(iconImage, blockLeft, iconY, iconSize, iconSize);
  }

  // Draw text with shadow
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = Math.round(fontSize * 0.35);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(fontSize * 0.15);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(siteLabel, blockRight, textY);
  ctx.shadowColor = "transparent";

  const outputBuffer = canvas.toBuffer("image/png");
  if (!blobToken) {
    console.warn("[AI] BLOB_READ_WRITE_TOKEN missing; returning data URL overlay");
    return `data:image/png;base64,${outputBuffer.toString("base64")}`;
  }

  try {
    const fileName = `generated/brand-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.png`;
    const blob = await put(fileName, outputBuffer, {
      access: "public",
      contentType: "image/png",
      token: blobToken,
    });

    return blob.url;
  } catch (error) {
    console.warn("[AI] Failed to upload branded overlay, returning data URL:", error);
    return `data:image/png;base64,${outputBuffer.toString("base64")}`;
  }
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

// Generate image using GPT Image 1.5
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

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const error = "No image generation API configured (need OPENAI_API_KEY)";
    await trackAIUsage({
      type: "image_generation",
      model: "gpt-image-1.5",
      cost: 0,
      success: false,
      errorMsg: error,
      postId,
      source,
    });
    throw new Error(error);
  }

  const model = "gpt-image-1-mini";
  const size = "1536x1024" as const;
  const quality = "low" as const;
  const cost = IMAGE_GEN_COST["gpt-image-1-mini-1536x1024-low"];

  const imageStyles = [
    // Style 1: Forest Serenity — sunlit woods, car small and side-on, rich woodland detail
    `A stunning cinematic automotive photograph of a sleek modern electric vehicle gliding through a lush, sun-drenched forest. The car is in side profile or 3/4 rear angle — small in the frame, occupying no more than 35% of image width, placed in the left or right third. The scene is rich with natural detail: tall ancient trees with textured bark flank the winding asphalt road, their canopy alive with golden sunlight streaming through in dramatic shafts. The forest floor is carpeted with ferns, wildflowers, and fallen leaves. A shallow rocky stream is visible catching light between the trees in the background. Dappled shadows play across the road surface. In the far distance, a soft clearing hints at open sky beyond the tree line. Mood: serene, vibrant, alive — like a nature documentary. Rich deep greens, amber sunlight, fresh shadows. NO fog, NO haze, NO yellowish overcast. NO text, logos, or license plates. Bottom-right: blurred mossy road edge or soft fern bokeh for overlay space.`,

    // Style 2: Dynamic Curve — high-speed corner, motion blur, dramatic environment
    `A high-energy cinematic automotive action shot of a sleek modern electric vehicle carving through a sweeping mountain curve at speed. Camera angle is low and slightly behind, offset to the side. The car is in a powerful 3/4 rear-angle stance — NOT head-on. Strong motion blur streaks the road surface and surrounding pines. The tarmac has worn white lane markings and subtle tire tracks that add realism. Rocky cliff faces rise on one side of the road, draped in moss and small ferns. On the other side, the land drops away revealing a breathtaking forested valley far below. Dramatic cumulus clouds in a vivid blue sky tower above the ridge. Shafts of afternoon sunlight cut through the valley. A hawk or eagle is faintly visible soaring in the mid-distance. Colors: vivid pine greens, warm tarmac grays, crisp sky blue, golden light. Mood: fast, powerful, thrilling. NO fog, NO haze. NO text, logos, or license plates. Bottom-right: blurred road surface with motion streaks for overlay space.`,

    // Style 3: Mountain Vista — epic wide landscape, car tiny, rich foreground
    `A breathtaking ultra-wide cinematic landscape photograph with a sleek modern electric vehicle as a tiny element on a dramatic mountain road. The car is very small — less than 20% of frame width — visible in mid-distance, side profile, winding along a narrow road that ribbons through the terrain. The composition is epic in scale: the foreground features alpine wildflowers in vibrant purples and yellows, with rocks and low shrubs adding texture. The road winds past a crystal-clear glacial lake that mirrors the sky and snow-capped peaks beyond. Majestic mountains dominate the upper half of the frame, their rocky summits dusted with snow. A dramatic cloudscape — large white cumulus against deep blue sky — fills the upper third. Late afternoon light casts long golden shadows across the valley. Colors: vivid sky blue, emerald lake, white snow, golden meadow. Mood: epic, free, awe-inspiring. NO fog, NO haze. NO text, logos, or license plates. Bottom-right: clear sky or still lake surface for overlay space.`,

    // Style 4: Coastal Speed — low angle, dramatic ocean, golden hour richness
    `A cinematic low-angle automotive photograph of a sleek modern electric vehicle powering along a dramatic clifftop coastal highway at golden hour. Camera hugs the road surface, angled to the side and slightly behind the car — which occupies the left or right third of the frame in a sleek side or 3/4 rear profile. The scene is richly layered: in the foreground, coastal wildflowers and dry golden grass cling to the cliff edge. Below the cliff, waves crash spectacularly against dark volcanic rocks, sending white spray into the air. The vivid turquoise and deep navy ocean stretches to a glowing horizon. A distant sailboat is silhouetted against the orange sky. Overhead, a few long wispy cirrus clouds catch the last warm light. Motion blur on the wheels and road surface conveys effortless speed. Colors: vivid ocean blues, fiery golden horizon, warm amber on the car body. Mood: luxurious, aspirational, free. NO fog, NO flat overcast. NO text, logos, or license plates. Bottom-right: blurred cliff-edge grass or ocean surface for overlay space.`,
  ];

  const styleIndex = Math.floor(Math.random() * imageStyles.length);
  const imagePrompt = `${imageStyles[styleIndex]}
Topic context: ${title}. ${summary.slice(0, 150)}`;

  const openai = new OpenAI({ apiKey: openaiKey });

  let imageUrl: string;
  try {
    const response = await openai.images.generate({
      model,
      prompt: imagePrompt,
      n: 1,
      size,
      quality,
    });

    const url = response.data?.[0]?.url;
    const b64 = response.data?.[0]?.b64_json;
    if (url) {
      imageUrl = url;
    } else if (b64) {
      // gpt-image-1 family returns base64 by default, not a URL
      imageUrl = `data:image/png;base64,${b64}`;
    } else {
      throw new Error("GPT Image 1 Mini: no image data returned (no url or b64_json)");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await trackAIUsage({
      type: "image_generation",
      model,
      size,
      cost: 0,
      success: false,
      errorMsg,
      postId,
      source,
    });
    throw error;
  }

  await trackAIUsage({
    type: "image_generation",
    model,
    size,
    cost,
    success: true,
    postId,
    source,
  });

  console.log(`GPT Image 1 Mini generated for: ${title.slice(0, 50)}... [source: ${source}, cost: $${cost}]`);

  try {
    return await applyBrandingOverlay(imageUrl);
  } catch (error) {
    console.warn("[AI] Branding overlay failed, using original image:", error);
    return imageUrl;
  }
}
