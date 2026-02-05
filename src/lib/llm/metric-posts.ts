import OpenAI from "openai";
import { Brand } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BRAND_TREND_PROMPT, ALL_BRANDS_PROMPT } from "@/lib/config/prompts";
import { POSTING_CONFIG } from "@/lib/config/posting";
import {
  BrandTrendData,
  AllBrandsData,
  BRAND_DISPLAY_NAMES,
} from "@/lib/metrics/delivery-data";

// Text completion pricing (per 1M tokens)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
} as const;

// Calculate cost for text completion
function calculateTextCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    TEXT_COMPLETION_COST[model as keyof typeof TEXT_COMPLETION_COST];
  if (!pricing) return 0;
  return (
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  );
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
  try {
    await prisma.aIUsage.create({ data: params });
  } catch (error) {
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

/**
 * Call DeepSeek API for text generation
 */
async function callDeepSeek(
  prompt: string,
  source: string
): Promise<string> {
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

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(provider.model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model: provider.model,
    cost,
    success: true,
    source,
    inputTokens,
    outputTokens,
  });

  return content.trim();
}

/**
 * Call OpenAI API for text generation (fallback)
 */
async function callOpenAI(
  prompt: string,
  model: string,
  source: string
): Promise<string> {
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

  // Track token usage
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateTextCost(model, inputTokens, outputTokens);

  await trackAIUsage({
    type: "text_completion",
    model,
    cost,
    success: true,
    source,
    inputTokens,
    outputTokens,
  });

  return content.trim();
}

/**
 * Generate text using LLM with fallback
 */
async function generateText(prompt: string, source: string): Promise<string> {
  try {
    console.log(`[MetricPosts] Trying DeepSeek for ${source}...`);
    const content = await callDeepSeek(prompt, source);
    console.log(`[MetricPosts] DeepSeek succeeded for ${source}`);
    return content;
  } catch (deepseekError) {
    console.log(
      `[MetricPosts] DeepSeek failed for ${source}, trying GPT-4o-mini...`,
      deepseekError
    );

    try {
      const content = await callOpenAI(prompt, "gpt-4o-mini", source);
      console.log(`[MetricPosts] GPT-4o-mini succeeded for ${source}`);
      return content;
    } catch (openaiError) {
      console.error(`[MetricPosts] Both providers failed for ${source}`);
      throw new Error(
        `Failed to generate text: DeepSeek and OpenAI both failed. Last error: ${openaiError}`
      );
    }
  }
}

/**
 * Format brand trend data as text for LLM prompt
 */
function formatBrandTrendData(data: BrandTrendData): string {
  const lines = data.months.map((m) => {
    const prevStr = m.previous
      ? `(prev: ${(m.previous.value / 1000).toFixed(0)}K)`
      : "(no prev data)";
    const yoyStr =
      m.yoyChange !== null ? `YoY: ${m.yoyChange >= 0 ? "+" : ""}${m.yoyChange.toFixed(1)}%` : "";
    return `${m.monthName}: ${(m.current.value / 1000).toFixed(0)}K ${prevStr} ${yoyStr}`;
  });

  const totalLine = data.yearTotal.previous
    ? `Year Total: ${(data.yearTotal.current / 1000).toFixed(0)}K (prev: ${(data.yearTotal.previous / 1000).toFixed(0)}K, YoY: ${data.yearTotal.yoyChange?.toFixed(1)}%)`
    : `Year Total: ${(data.yearTotal.current / 1000).toFixed(0)}K`;

  return [...lines, totalLine].join("\n");
}

/**
 * Format all brands comparison data as text for LLM prompt
 */
function formatAllBrandsData(data: AllBrandsData): string {
  const lines = data.brands.map((b) => {
    const yoyStr =
      b.yoyChange !== null ? `(YoY: ${b.yoyChange >= 0 ? "+" : ""}${b.yoyChange.toFixed(1)}%)` : "";
    return `#${b.ranking} ${b.brandName}: ${(b.value / 1000).toFixed(0)}K ${yoyStr}`;
  });

  if (data.industryTotal) {
    const totalYoy =
      data.industryTotal.yoyChange !== null
        ? `(YoY: ${data.industryTotal.yoyChange >= 0 ? "+" : ""}${data.industryTotal.yoyChange.toFixed(1)}%)`
        : "";
    lines.push(`Industry Total: ${(data.industryTotal.value / 1000).toFixed(0)}K ${totalYoy}`);
  }

  return lines.join("\n");
}

/**
 * Generate tweet content for brand monthly trend
 */
export async function generateBrandTrendContent(
  data: BrandTrendData
): Promise<string> {
  const formattedData = formatBrandTrendData(data);
  const prompt = BRAND_TREND_PROMPT.replace("{brand}", data.brandName)
    .replace("{year}", data.year.toString())
    .replace("{trend_data}", formattedData);

  return generateText(prompt, "metric_brand_trend");
}

/**
 * Generate tweet content for all brands comparison
 */
export async function generateAllBrandsContent(
  data: AllBrandsData
): Promise<string> {
  const formattedData = formatAllBrandsData(data);
  const monthName = data.monthName;
  const prompt = ALL_BRANDS_PROMPT.replace("{month}", monthName)
    .replace("{year}", data.year.toString())
    .replace("{comparison_data}", formattedData);

  return generateText(prompt, "metric_all_brands");
}

/**
 * Get hashtags for metric posts
 */
export function getMetricPostHashtags(brands: Brand[]): string[] {
  const hashtags = ["#ChinaEV", "#EVNews"]; // Always include

  // Add brand-specific hashtags
  for (const brand of brands.slice(0, 3)) {
    const brandName = BRAND_DISPLAY_NAMES[brand];
    const brandTag = POSTING_CONFIG.BRAND_HASHTAGS[brandName];
    if (brandTag && !hashtags.includes(brandTag)) {
      hashtags.push(brandTag);
    }
  }

  return hashtags;
}

/**
 * Format complete tweet with footer and hashtags
 */
export function formatMetricPostTweet(
  content: string,
  brands: Brand[]
): string {
  const hashtags = getMetricPostHashtags(brands);
  const hashtagStr = hashtags.join(" ");
  return `${content}\n\n🍋 ${POSTING_CONFIG.SITE_URL}\n${hashtagStr}`;
}
