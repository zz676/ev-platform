import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { QUERY_GENERATOR_PROMPT } from "@/lib/config/prompts";
import { normalizeTableName } from "@/lib/data-explorer/table-name";

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

// Suggested questions for quick access
export const SUGGESTED_QUESTIONS = {
  "Brand Deliveries": [
    "BYD monthly deliveries in 2024",
    "Compare NIO, XPeng, Li Auto last 12 months",
    "Top 5 brands by deliveries January 2025",
    "Tesla China vs BYD quarterly trend",
    "Xiaomi monthly deliveries since launch",
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
  const prompt = `${QUERY_GENERATOR_PROMPT}

User question: "${question}"

Output the result as JSON with fields: table, query, chartType, chartTitle, explanation`;

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
