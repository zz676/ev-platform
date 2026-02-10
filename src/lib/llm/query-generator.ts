import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { QUERY_GENERATOR_PROMPT } from "@/lib/config/prompts";
import { normalizeTableName } from "@/lib/data-explorer/table-name";
import { Brand, MetricType, PeriodType } from "@prisma/client";

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

type SuggestedQuestions = Record<string, string[]>;

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

export class LLMUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

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

// Query generation response
export interface GeneratedQuery {
  table: string;
  query: Record<string, unknown>;
  chartType: "bar" | "line" | "horizontalBar";
  chartTitle: string;
  explanation?: string;
}

// Suggested questions for quick access (fallback when DB is unreachable)
export const SUGGESTED_QUESTIONS: SuggestedQuestions = {
  "Brand Deliveries": [
    "NIO monthly deliveries in 2026",
    "Compare NIO, XPeng, Li Auto last 12 months",
    "Top brands by deliveries in 2026",
    "Tesla China sales in 2026",
    "XPeng deliveries in 2025",
  ],
  "Industry Sales": [
    "Total NEV sales trend 2024",
    "NEV retail vs wholesale gap last 6 months",
    "CAAM vs CPCA sales comparison 2024",
    "NEV production vs sales 2024",
  ],
  "Market Health": [
    "Dealer inventory coefficient trend 2024",
    "VIA Index last 12 months",
    "Passenger car inventory levels trend",
  ],
  "Battery Industry": [
    "CATL vs BYD battery installations 2024",
    "Top 10 battery makers global market share",
    "China battery installation monthly trend",
    "Battery production vs installation gap",
  ],
  Exports: [
    "Tesla Shanghai exports 2024",
    "Top exporting plants by volume",
    "BYD export trend by plant",
  ],
  "Vehicle Specs": [
    "Compare NIO and Li Auto SUV specs",
    "Cheapest EVs with 500km+ range",
    "Fastest accelerating Chinese EVs",
    "BEV vs EREV price comparison",
  ],
};

type LiveDbHints = {
  latestEvMetricYear: number | null;
  evMetricYears: number[];
  deliveryMonthlyBrandsLatestYear: Brand[];
};

let liveHintsCache: { value: LiveDbHints; expiresAtMs: number } | null = null;

async function getLiveDbHints(): Promise<LiveDbHints> {
  const now = Date.now();
  if (liveHintsCache && liveHintsCache.expiresAtMs > now) return liveHintsCache.value;

  const yearsRows = await prisma.eVMetric.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: [{ year: "desc" }],
    take: 8,
  });

  const evMetricYears = yearsRows.map((r) => r.year);
  const latestEvMetricYear = evMetricYears[0] ?? null;

  let deliveryMonthlyBrandsLatestYear: Brand[] = [];
  if (latestEvMetricYear !== null) {
    const brandsRows = await prisma.eVMetric.findMany({
      where: {
        metric: MetricType.DELIVERY,
        periodType: PeriodType.MONTHLY,
        year: latestEvMetricYear,
        brand: { not: Brand.INDUSTRY },
      },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: [{ brand: "asc" }],
    });
    deliveryMonthlyBrandsLatestYear = brandsRows.map((r) => r.brand);
  }

  const value: LiveDbHints = {
    latestEvMetricYear,
    evMetricYears,
    deliveryMonthlyBrandsLatestYear,
  };

  liveHintsCache = { value, expiresAtMs: now + 5 * 60_000 };
  return value;
}

export async function getSuggestedQuestions(): Promise<SuggestedQuestions> {
  try {
    const hints = await getLiveDbHints();
    const year = hints.latestEvMetricYear ?? new Date().getFullYear();
    const brands = hints.deliveryMonthlyBrandsLatestYear
      .filter((b) => b !== Brand.OTHER_BRAND && b !== Brand.INDUSTRY)
      .slice(0, 4);

    const a = brands[0] || Brand.NIO;
    const b = brands[1] || Brand.XPENG;
    const c = brands[2] || Brand.LI_AUTO;

    return {
      "Brand Deliveries": [
        `${a} monthly deliveries in ${year}`,
        `Compare ${a}, ${b}, ${c} last 12 months`,
        `Top brands by deliveries in ${year}`,
      ],
      "Industry Sales": SUGGESTED_QUESTIONS["Industry Sales"],
      "Market Health": SUGGESTED_QUESTIONS["Market Health"],
      "Battery Industry": SUGGESTED_QUESTIONS["Battery Industry"],
      Exports: SUGGESTED_QUESTIONS.Exports,
      "Vehicle Specs": SUGGESTED_QUESTIONS["Vehicle Specs"],
    };
  } catch {
    return SUGGESTED_QUESTIONS;
  }
}

function buildPromptWithLiveDbHints(base: string, hints: LiveDbHints): string {
  const yearText =
    hints.latestEvMetricYear !== null ? String(hints.latestEvMetricYear) : "unknown";
  const yearsText = hints.evMetricYears.length ? hints.evMetricYears.join(", ") : "unknown";
  const brandsText = hints.deliveryMonthlyBrandsLatestYear.length
    ? hints.deliveryMonthlyBrandsLatestYear.join(", ")
    : "unknown";

  return `${base}

LIVE DATABASE SNAPSHOT (use this to avoid empty results):
- eVMetric available years: ${yearsText}
- eVMetric brands with DELIVERY+MONTHLY in latest year (${yearText}): ${brandsText}

IMPORTANT OVERRIDES:
- If user doesn't specify a year, default to the latest year in the snapshot (not 2025).
- For EVMetric deliveries, use periodType=MONTHLY by default. Only use QUARTERLY/YEARLY if the user explicitly asks for it.
- If the user asks for a brand that has no DELIVERY data in the snapshot year, prefer a closest available brand (or OTHER_BRAND) and mention the limitation in the explanation.
`.trim();
}

/**
 * Call DeepSeek API for query generation
 */
async function callDeepSeek(
  prompt: string,
  source: string
): Promise<string> {
  const { provider, client } = getProvider("deepseek");

  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    temperature: 0.3, // Lower temperature for more consistent output
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
 * Call OpenAI API for query generation (fallback)
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
    max_tokens: 800,
    temperature: 0.3,
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
 * Parse LLM response to extract JSON
 */
function parseQueryResponse(response: string): GeneratedQuery {
  // Try to find JSON in the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!parsed.table || !parsed.query) {
    throw new Error("Invalid response: missing table or query");
  }

  return {
    table: parsed.table,
    query: parsed.query,
    chartType: parsed.chartType || "bar",
    chartTitle: parsed.chartTitle || "Data Results",
    explanation: parsed.explanation,
  };
}

/**
 * Generate a database query from natural language question
 */
export async function generateQueryFromQuestion(
  question: string
): Promise<GeneratedQuery> {
  const hints = await getLiveDbHints().catch(() => ({
    latestEvMetricYear: null,
    evMetricYears: [],
    deliveryMonthlyBrandsLatestYear: [],
  }));

  const prompt = buildPromptWithLiveDbHints(
    `${QUERY_GENERATOR_PROMPT}

User question: "${question}"

Output the result as JSON with fields: table, query, chartType, chartTitle, explanation`,
    hints
  );

  let response: string;

  const deepseekEnabled = !DISABLE_DEEPSEEK && !!process.env.DEEPSEEK_API_KEY;

  if (deepseekEnabled) {
    try {
      console.log("[QueryGenerator] Trying DeepSeek...");
      response = await callDeepSeek(prompt, "query_generator");
      console.log("[QueryGenerator] DeepSeek succeeded");
    } catch (deepseekError) {
      console.warn(
        `[QueryGenerator] DeepSeek failed: ${describeError(deepseekError)}. Trying GPT-4o-mini...`
      );
      response = "";
    }
  } else {
    response = "";
  }

  if (!response) {
    try {
      response = await callOpenAI(prompt, "gpt-4o-mini", "query_generator");
      console.log("[QueryGenerator] GPT-4o-mini succeeded");
    } catch (openaiError) {
      const msg = describeError(openaiError);
      console.warn(`[QueryGenerator] OpenAI failed: ${msg}`);
      throw new LLMUnavailableError(
        `LLM providers unavailable right now. Please retry in a minute. ${msg}`
      );
    }
  }

  const parsed = parseQueryResponse(response);
  return {
    ...parsed,
    table: normalizeTableName(parsed.table),
  };
}
