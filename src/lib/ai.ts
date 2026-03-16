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

export async function applyBrandingOverlay(imageUrl: string): Promise<string> {
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

  // Logo size: ~14% of image height, positioned bottom-right with padding
  const padding = Math.round(width * 0.025);
  const logoSize = Math.round(height * 0.14);

  const logoPath = path.join(process.cwd(), "public", "juiceindex-logo.png");
  try {
    const logoImage = await loadImage(logoPath);
    const logoX = width - padding - logoSize;
    const logoY = height - padding - logoSize;
    // Subtle drop shadow for legibility on any background
    ctx.shadowColor = "rgba(0, 0, 0, 0.30)";
    ctx.shadowBlur = Math.round(logoSize * 0.08);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(logoSize * 0.04);
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.shadowColor = "transparent";
  } catch {
    console.warn("[AI] Could not load juiceindex-logo.png, skipping branding overlay");
  }

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
    // Style 1: Electric Formula Race Car — street circuit, head-on drama
    `A breathtaking cinematic motorsport photograph of a bold electric Formula-style single-seater race car charging directly toward the camera at full speed on a twisting street circuit. The camera is ultra-low, almost road-level, so the nose of the car fills the bottom-center of the frame with explosive presence. The front wing, exposed wheels, and aerodynamic body are sharp and dramatic. Behind the car: vibrant safety barriers painted in vivid red and blue stripes, a tunnel entrance with glowing orange light spilling out, and a sea of blurred crowd grandstands packed with fans. Motion blur streaks the barriers on both sides. Sparks fly from the underside of the car as it scrapes the road. The livery is an eye-popping neon yellow and electric blue. Colors: saturated neon yellow, cobalt blue, vivid red barriers, golden tunnel glow. Mood: thunderous, heart-pounding, electric. NO text, logos, or license plates. Bottom-right corner: blurred tarmac and sparks for overlay space.`,

    // Style 2: Classic American Muscle Revival — desert sunset, front 3/4 glory
    `A stunning cinematic automotive photograph of a powerful wide-body American classic muscle car with a long hood, squared haunches, chrome details, and twin exhausts, parked at a dramatic 3/4 front angle on a cracked desert salt flat at sunset. The car faces slightly toward the camera, commanding and aggressive. Its paint is a deep candy-apple red with metallic flake that blazes in the last light. Chrome bumpers, headlights, and wide flared fenders catch the orange glow. The desert stretches endlessly behind it: flat blinding white salt, then distant purple mesas silhouetted against a sky on fire with orange, crimson, and violet. Heat shimmer ripples off the hood. A long dark shadow stretches behind the car toward the camera. Colors: deep candy red, blazing orange sky, white salt flat, purple mountains. Mood: raw power, American freedom, golden-era nostalgia. NO text, logos, or license plates. Bottom-right: cracked salt flat texture fading to shadow for overlay space.`,

    // Style 3: Hypercar Head-On Tunnel Blast — underground drama
    `An ultra-dramatic cinematic photograph of a low-slung hypercar racing head-on through a dramatic concrete tunnel at full throttle. The car is centered, aimed directly at the camera, filling the mid-frame with an aggressive wide-body stance featuring a huge carbon splitter, gaping front intakes, and quad headlights blazing white. The tunnel walls are raw concrete with streaks of moisture and bold yellow reflective markers that blur into glowing ribbons on both sides from the speed. Brake rotors glow amber-red behind the front wheels. The tunnel exit far behind the car is a tiny blinding white circle of daylight. The car's paint is deep matte carbon-black with vivid orange aerodynamic accents. Colors: carbon black and orange, glowing amber brakes, streaking yellow markers, white exit light. Mood: ferocious, explosive, otherworldly. NO text, logos, or license plates. Bottom-right: blurred wet concrete tunnel floor for overlay space.`,

    // Style 4: Classic 1960s Sports Roadster — Italian Riviera, golden hour
    `A gorgeous cinematic photograph of a curvaceous 1960s Italian-inspired open-top sports roadster with a long elegant hood, round headlights, wire wheels, and hand-formed aluminum bodywork, gliding through a winding cliffside road on the Italian Riviera at golden hour. The car is shot from a slightly elevated side-front angle with the driver's scarf trailing in the wind. Below the cliff edge: brilliant turquoise Mediterranean sea with white sailboats. Above: a terracotta-walled village clings to the hillside. Bougainvillea vines in vivid magenta cascade over the stone wall beside the road. The car's paint is a rich British racing green. Sunlight rakes across the aluminum hood in warm gold. Colors: British racing green, warm gold light, turquoise sea, magenta bougainvillea, terracotta walls. Mood: romantic, timeless, legendary. NO text, logos, or license plates. Bottom-right: sun-dappled stone road fading into warm blur for overlay space.`,

    // Style 5: Electric Rally Car — forest stage, flying mud and drama
    `A ferocious cinematic action photograph of a compact electric rally car launching sideways through a forest stage at full attack, front wheels cocked hard in a spectacular power-slide around a muddy gravel corner. Camera is low and slightly ahead, looking back as the car fills the left two-thirds of the frame in an aggressive 3/4 front angle. A massive rooster-tail of mud and gravel explodes from the rear wheels in a wide arc. Pine trees line the narrow stage road with their trunks streaked by mud splatter from previous competitors. Fallen leaves and small rocks pepper the air. The car's livery is vivid white with bold neon-green and black rally blocks. Roof-mounted LED light bar blazes white in the forest. Colors: brilliant white and neon green car, dark pine forest, flying brown mud, dappled forest light. Mood: wild, unhinged, heart-in-mouth rally drama. NO text, logos, or license plates. Bottom-right: blurred gravel and mud spray for overlay space.`,

    // Style 6: Neon Cyberpunk EV Supercar — rain-soaked night city
    `A cinematic night photograph of a futuristic electric supercar with an aggressive low wedge shape, active aerodynamics, and glowing underbody LED strips, sitting on a rain-soaked urban street in a neon-drenched city. Camera is low-angle and front 3/4, the car's headlights cut razor-sharp beams into the lens and reflect in the wet tarmac as two rivers of pure white light. Neon signs in vivid pink, teal, and orange reflect in the glossy car body and flooded street surface. Steam rises from manhole covers. A blurred crowd with colorful umbrellas lines the wet sidewalk behind. The skyline is packed with skyscrapers whose windows form a mosaic of warm gold light against an indigo-purple sky. The car's paint shifts from deep violet to electric blue in the neon reflections. Colors: violet-blue car, neon pink and teal reflections, white headlight beams, indigo night sky. Mood: cinematic cyberpunk, electric future, rain-soaked beauty. NO text, logos, or license plates. Bottom-right: wet reflective tarmac with neon color pools for overlay space.`,
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
