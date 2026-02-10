import OpenAI from "openai";
import { Post } from "@prisma/client";
import { DIGEST_PROMPT, DIGEST_TITLE } from "@/lib/config/prompts";
import { POSTING_CONFIG } from "@/lib/config/posting";
import prisma from "@/lib/prisma";

// In serverless, long timeouts + multi-retries can exceed the function time budget.
const DEFAULT_LLM_TIMEOUT_MS = process.env.VERCEL ? 8000 : 15000;
const DEFAULT_LLM_MAX_RETRIES = process.env.VERCEL ? 1 : 2;
const LLM_TIMEOUT_MS = parseInt(
  process.env.LLM_TIMEOUT_MS || String(DEFAULT_LLM_TIMEOUT_MS),
  10
);
const LLM_MAX_RETRIES = parseInt(
  process.env.LLM_MAX_RETRIES || String(DEFAULT_LLM_MAX_RETRIES),
  10
);
const DISABLE_DEEPSEEK = process.env.DISABLE_DEEPSEEK === "true";

// Text completion pricing (per 1M tokens)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
} as const;

// Calculate cost for text completion
function calculateTextCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = TEXT_COMPLETION_COST[model as keyof typeof TEXT_COMPLETION_COST];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Track AI usage in database
async function trackAIUsage(params: {
  type: string;
  model: string;
  cost: number;
  success: boolean;
  errorMsg?: string;
  source: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
    console.error("Failed to track AI usage:", error);
  }
}

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

const providerClients: Record<string, OpenAI | undefined> = {};

function describeError(err: unknown): string {
  if (!err) return "unknown error";
  if (err instanceof Error) {
    const anyErr = err as unknown as { [key: string]: unknown; cause?: unknown };
    const parts: string[] = [];
    if (err.name) parts.push(err.name);
    if (err.message) parts.push(err.message);
    if (typeof anyErr.status === "number") parts.push(`status=${anyErr.status}`);
    if (typeof anyErr.code === "string") parts.push(`code=${anyErr.code}`);
    if (typeof anyErr.type === "string") parts.push(`type=${anyErr.type}`);

    if (anyErr.cause && typeof anyErr.cause === "object") {
      const cause = anyErr.cause as { [key: string]: unknown };
      if (typeof cause.code === "string") parts.push(`cause.code=${cause.code}`);
      if (typeof cause.message === "string") {
        parts.push(`cause.message=${cause.message.slice(0, 160)}`);
      }
    }
    return parts.join(" ");
  }
  return String(err);
}

function getProvider(name: "deepseek" | "openai") {
  const provider = providers.find((p) => p.name === name);
  if (!provider?.apiKey) {
    throw new Error(`${name === "deepseek" ? "DeepSeek" : "OpenAI"} API key not configured`);
  }

  if (!providerClients[name]) {
    providerClients[name] = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      timeout: LLM_TIMEOUT_MS,
      maxRetries: LLM_MAX_RETRIES,
    });
  }

  return { provider, client: providerClients[name]! };
}

function fallbackDigestBullets(posts: Post[]): string {
  const top = posts.slice(0, 4);
  const lines = top.map((p, idx) => {
    const title = (p.translatedTitle || p.originalTitle || "Untitled").trim();
    const summary = (p.translatedSummary || "").trim();
    const summaryShort = summary ? summary.replace(/\s+/g, " ").slice(0, 90) : "";
    const suffix = summaryShort ? `: ${summaryShort}${summary.length > 90 ? "..." : ""}` : "";
    return `${idx + 1}. ${title}${suffix}`;
  });
  return lines.join("\n");
}

/**
 * Call DeepSeek API for text generation
 */
async function callDeepSeek(prompt: string): Promise<string> {
  const { provider, client } = getProvider("deepseek");

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

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(provider.model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model: provider.model,
    cost,
    success: true,
    source: "digest_deepseek",
    inputTokens,
    outputTokens,
  });

  return content.trim();
}

/**
 * Call OpenAI API for text generation (fallback)
 */
async function callOpenAI(prompt: string, model: string): Promise<string> {
  const { client } = getProvider("openai");

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

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    source: "digest_openai",
    inputTokens,
    outputTokens,
  });

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

  const deepseekEnabled = !DISABLE_DEEPSEEK && !!process.env.DEEPSEEK_API_KEY;

  if (deepseekEnabled) {
    try {
      console.log("[Digest] Trying DeepSeek for digest generation...");
      const content = await callDeepSeek(prompt);
      console.log("[Digest] DeepSeek succeeded");
      return content;
    } catch (deepseekError) {
      console.warn(
        `[Digest] DeepSeek failed: ${describeError(deepseekError)}. Trying GPT-4o-mini...`
      );
    }
  } else {
    console.log("[Digest] DeepSeek disabled/missing key; using GPT-4o-mini...");
  }

  try {
    const content = await callOpenAI(prompt, "gpt-4o-mini");
    console.log("[Digest] GPT-4o-mini succeeded");
    return content;
  } catch (openaiError) {
    const msg = describeError(openaiError);
    console.warn(`[Digest] OpenAI failed: ${msg}. Using fallback digest bullets.`);
    await trackAIUsage({
      type: "text_completion",
      model: "fallback",
      cost: 0,
      success: false,
      errorMsg: msg.slice(0, 500),
      source: "digest_fallback",
    });
    return fallbackDigestBullets(posts);
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
