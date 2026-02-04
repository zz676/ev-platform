import OpenAI from "openai";
import { Post } from "@prisma/client";
import { DIGEST_PROMPT, DIGEST_TITLE } from "@/lib/config/prompts";
import { POSTING_CONFIG } from "@/lib/config/posting";

// AI Provider configuration for digest generation
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

/**
 * Call DeepSeek API for text generation
 */
async function callDeepSeek(prompt: string): Promise<string> {
  const provider = providers.find((p) => p.name === "deepseek");
  if (!provider?.apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned empty response");
  }

  return content.trim();
}

/**
 * Call OpenAI API for text generation (fallback)
 */
async function callOpenAI(prompt: string, model: string): Promise<string> {
  const provider = providers.find((p) => p.name === "openai");
  if (!provider?.apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return content.trim();
}

/**
 * Generate digest content from multiple posts using LLM
 * Tries DeepSeek first (cheaper), falls back to GPT-4o-mini
 */
export async function generateDigestContent(posts: Post[]): Promise<string> {
  if (posts.length === 0) {
    throw new Error("No posts provided for digest generation");
  }

  // Format posts for the prompt - pass full summaries for better context
  const postSummaries = posts
    .map((p, i) => {
      const title = p.translatedTitle || p.originalTitle || "Untitled";
      const summary = p.translatedSummary || "";
      return `${i + 1}. ${title}\n   ${summary}`;
    })
    .join("\n\n");

  const prompt = DIGEST_PROMPT.replace("{posts}", postSummaries);

  try {
    // Try DeepSeek first (cheapest)
    console.log("[Digest] Trying DeepSeek for digest generation...");
    const content = await callDeepSeek(prompt);
    console.log("[Digest] DeepSeek succeeded");
    return content;
  } catch (deepseekError) {
    console.log("[Digest] DeepSeek failed, trying GPT-4o-mini...", deepseekError);

    try {
      const content = await callOpenAI(prompt, "gpt-4o-mini");
      console.log("[Digest] GPT-4o-mini succeeded");
      return content;
    } catch (openaiError) {
      console.error("[Digest] Both providers failed");
      throw new Error(
        `Failed to generate digest: DeepSeek and OpenAI both failed. Last error: ${openaiError}`
      );
    }
  }
}

/**
 * Extract brand hashtags from posts based on content
 */
export function extractBrandHashtags(posts: Post[]): string[] {
  const found = new Set<string>();
  const text = posts
    .map((p) => `${p.translatedTitle} ${p.translatedSummary}`)
    .join(" ");

  for (const [brand, hashtag] of Object.entries(POSTING_CONFIG.BRAND_HASHTAGS)) {
    if (text.includes(brand)) {
      found.add(hashtag);
    }
  }

  return Array.from(found).slice(0, 3); // Max 3 brand hashtags
}

/**
 * Format final digest tweet with site link and hashtags
 */
export function formatDigestTweet(
  content: string,
  siteUrl: string,
  baseHashtags: string[],
  posts: Post[]
): string {
  const brandHashtags = extractBrandHashtags(posts);
  const allHashtags = [...baseHashtags, ...brandHashtags];
  const hashtagStr = allHashtags.join(" ");
  return `${content}\n\n🍋 ${siteUrl}\n${hashtagStr}`;
}

/**
 * Generate a complete formatted digest tweet ready for storage and posting
 * Includes: title + LLM bullets + site link + hashtags
 */
export async function generateFullDigestTweet(posts: Post[]): Promise<string> {
  // Get LLM-generated bullets
  const bullets = await generateDigestContent(posts);

  // Build hashtags: base site hashtags + brand-specific ones
  const brandHashtags = extractBrandHashtags(posts);
  // Take first 4 base hashtags and up to 3 brand hashtags (max 6 total)
  const baseHashtags = POSTING_CONFIG.SITE_HASHTAGS.slice(0, 4);
  const allHashtags = [...baseHashtags, ...brandHashtags].slice(0, 6);
  const hashtagStr = allHashtags.join(" ");

  // Assemble full tweet: title + bullets + link + hashtags
  return `${DIGEST_TITLE}\n${bullets}\n\n🍋 ${POSTING_CONFIG.SITE_URL}\n${hashtagStr}`;
}
