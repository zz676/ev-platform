import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { QUERY_GENERATOR_PROMPT } from "@/lib/config/prompts";

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

  try {
    console.log("[QueryGenerator] Trying DeepSeek...");
    response = await callDeepSeek(prompt, "query_generator");
    console.log("[QueryGenerator] DeepSeek succeeded");
  } catch (deepseekError) {
    console.log(
      "[QueryGenerator] DeepSeek failed, trying GPT-4o-mini...",
      deepseekError
    );

    try {
      response = await callOpenAI(prompt, "gpt-4o-mini", "query_generator");
      console.log("[QueryGenerator] GPT-4o-mini succeeded");
    } catch (openaiError) {
      console.error("[QueryGenerator] Both providers failed");
      throw new Error(
        `Failed to generate query: DeepSeek and OpenAI both failed. Last error: ${openaiError}`
      );
    }
  }

  return parseQueryResponse(response);
}
