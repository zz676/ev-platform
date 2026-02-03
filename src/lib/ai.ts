import OpenAI from "openai";
import prisma from "@/lib/prisma";

// DALL-E pricing (as of 2024)
const DALLE_COST = {
  "dall-e-3": {
    "1024x1024": { standard: 0.04, hd: 0.08 },
    "1024x1792": { standard: 0.08, hd: 0.12 },
    "1792x1024": { standard: 0.08, hd: 0.12 },
  },
} as const;

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
}): Promise<void> {
  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    // Don't fail the main operation if tracking fails
    console.error("Failed to track AI usage:", error);
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
export async function processEVContent(content: string, source: string) {
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

  const result = response.choices[0].message.content;
  return result ? JSON.parse(result) : null;
}

// Translate content only
export async function translateContent(content: string) {
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

  return response.choices[0].message.content;
}

// Generate X post summary
export async function generateXSummary(content: string) {
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

  return response.choices[0].message.content;
}

// Generate image for X post using DALL-E (fallback when no scraped image)
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
  const model = "dall-e-3";
  const size = "1792x1024";
  const quality = "standard";
  const cost = DALLE_COST[model][size][quality];

  // DALL-E requires OpenAI directly (not DeepSeek)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const error = "OpenAI API key required for image generation";
    await trackAIUsage({
      type: "image_generation",
      model,
      size,
      cost: 0,
      success: false,
      errorMsg: error,
      postId,
      source,
    });
    throw new Error(error);
  }

  const openai = new OpenAI({
    apiKey: openaiKey,
  });

  // Create a prompt that generates relevant EV imagery
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

  try {
    const response = await openai.images.generate({
      model,
      prompt: imagePrompt,
      n: 1,
      size,
      quality,
    });

    if (!response.data || response.data.length === 0) {
      const error = "Failed to generate image: no data returned";
      await trackAIUsage({
        type: "image_generation",
        model,
        size,
        cost: 0,
        success: false,
        errorMsg: error,
        postId,
        source,
      });
      throw new Error(error);
    }

    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      const error = "Failed to generate image: no URL returned";
      await trackAIUsage({
        type: "image_generation",
        model,
        size,
        cost: 0,
        success: false,
        errorMsg: error,
        postId,
        source,
      });
      throw new Error(error);
    }

    // Track successful generation
    await trackAIUsage({
      type: "image_generation",
      model,
      size,
      cost,
      success: true,
      postId,
      source,
    });

    console.log(`AI image generated successfully for: ${title.slice(0, 50)}... [source: ${source}, cost: $${cost}]`);
    return imageUrl;
  } catch (error) {
    // Track failed generation (if not already tracked above)
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    if (!errorMsg.includes("Failed to generate image")) {
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
    }
    throw error;
  }
}
