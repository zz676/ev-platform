import OpenAI from "openai";
import { Post } from "@prisma/client";
import { DIGEST_PROMPT } from "@/lib/config/prompts";

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
    max_tokens: 300,
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
    max_tokens: 300,
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

  // Format posts for the prompt
  const postSummaries = posts
    .map((p, i) => {
      const title = p.translatedTitle || p.originalTitle || "Untitled";
      const summary = p.translatedSummary?.slice(0, 100) || "";
      return `${i + 1}. ${title}: ${summary}${summary.length >= 100 ? "..." : ""}`;
    })
    .join("\n");

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
 * Format final digest tweet with site link and hashtags
 */
export function formatDigestTweet(
  content: string,
  siteUrl: string,
  hashtags: string[]
): string {
  const hashtagStr = hashtags.join(" ");
  return `${content}\n\n🔗 ${siteUrl}\n${hashtagStr}`;
}
