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
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) return;
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

const providerClients: Record<string, OpenAI | undefined> = {};

function describeError(err: unknown): string {
  if (!err) return "unknown error";
  if (err instanceof Error) {
    const anyErr = err as unknown as {
      [key: string]: unknown;
      cause?: unknown;
    };
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

/**
 * Call DeepSeek API for text generation
 */
async function callDeepSeek(
  prompt: string,
  source: string
): Promise<string> {
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
  const deepseekEnabled = !DISABLE_DEEPSEEK && !!process.env.DEEPSEEK_API_KEY;

  if (deepseekEnabled) {
    try {
      console.log(`[MetricPosts] Trying DeepSeek for ${source}...`);
      const content = await callDeepSeek(prompt, source);
      console.log(`[MetricPosts] DeepSeek succeeded for ${source}`);
      return content;
    } catch (deepseekError) {
      console.warn(
        `[MetricPosts] DeepSeek failed for ${source}: ${describeError(deepseekError)}. Trying GPT-4o-mini...`
      );
    }
  } else {
    console.log(`[MetricPosts] DeepSeek disabled/missing key; using GPT-4o-mini for ${source}...`);
  }

  try {
    const content = await callOpenAI(prompt, "gpt-4o-mini", source);
    console.log(`[MetricPosts] GPT-4o-mini succeeded for ${source}`);
    return content;
  } catch (openaiError) {
    const msg = describeError(openaiError);
    console.warn(`[MetricPosts] OpenAI failed for ${source}: ${msg}`);
    throw new Error(`LLM providers failed (${source}). ${msg}`);
  }
}

function generateAllBrandsFallback(data: AllBrandsData): string {
  const top = data.brands.slice(0, 7);
  const lines = top.map((b) => {
    const yoy =
      b.yoyChange !== null
        ? ` (${b.yoyChange >= 0 ? "+" : ""}${b.yoyChange.toFixed(1)}% YoY)`
        : "";
    return `${b.ranking}. ${b.brandName}: ${(b.value / 1000).toFixed(0)}K${yoy}`;
  });

  const totalLine = data.industryTotal
    ? `Total: ${(data.industryTotal.value / 1000).toFixed(0)}K`
    : null;

  return [
    `🏆 ${data.monthName} ${data.year} China EV Deliveries`,
    ...lines,
    totalLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function generateBrandTrendFallback(data: BrandTrendData): string {
  const latest = [...data.months]
    .filter((m) => m.current?.value)
    .sort((a, b) => b.month - a.month)[0];

  const latestLine = latest
    ? `${latest.monthName}: ${(latest.current.value / 1000).toFixed(0)}K${
        latest.yoyChange !== null
          ? ` (${latest.yoyChange >= 0 ? "+" : ""}${latest.yoyChange.toFixed(1)}% YoY)`
          : ""
      }`
    : null;

  const totalLine = data.yearTotal.previous
    ? `YTD: ${(data.yearTotal.current / 1000).toFixed(0)}K (${data.yearTotal.yoyChange ? `${data.yearTotal.yoyChange >= 0 ? "+" : ""}${data.yearTotal.yoyChange.toFixed(1)}% YoY` : "YoY n/a"})`
    : `YTD: ${(data.yearTotal.current / 1000).toFixed(0)}K`;

  return [
    `📈 ${data.brandName} ${data.year} Deliveries Trend`,
    latestLine,
    totalLine,
  ]
    .filter(Boolean)
    .join("\n");
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

  try {
    return await generateText(prompt, "metric_brand_trend");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MetricPosts] LLM failed for metric_brand_trend, using fallback. ${msg}`);
    await trackAIUsage({
      type: "text_completion",
      model: "fallback",
      cost: 0,
      success: false,
      errorMsg: msg.slice(0, 500),
      source: "metric_brand_trend",
    });
    return generateBrandTrendFallback(data);
  }
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

  try {
    return await generateText(prompt, "metric_all_brands");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MetricPosts] LLM failed for metric_all_brands, using fallback. ${msg}`);
    await trackAIUsage({
      type: "text_completion",
      model: "fallback",
      cost: 0,
      success: false,
      errorMsg: msg.slice(0, 500),
      source: "metric_all_brands",
    });
    return generateAllBrandsFallback(data);
  }
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
