import OpenAI from "openai";
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

// Text completion pricing (per 1M tokens)
const TEXT_COMPLETION_COST = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
} as const;

function calculateTextCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = TEXT_COMPLETION_COST[model as keyof typeof TEXT_COMPLETION_COST];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

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

const providers = [
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
  if (err instanceof Error) return `${err.name} ${err.message}`;
  return String(err);
}

function getProvider(name: "openai") {
  const provider = providers.find((p) => p.name === name);
  if (!provider?.apiKey) throw new Error("OpenAI API key not configured");

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

async function callOpenAI(prompt: string): Promise<string> {
  const { client } = getProvider("openai");
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 350,
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned empty response");

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  await trackAIUsage({
    type: "text_completion",
    model: "gpt-4o-mini",
    cost: calculateTextCost("gpt-4o-mini", inputTokens, outputTokens),
    success: true,
    source: "data_explorer_post_openai",
    inputTokens,
    outputTokens,
  });

  return content;
}

export async function generateDataExplorerPostFromPrompt(prompt: string): Promise<string> {
  try {
    return await callOpenAI(prompt);
  } catch (err) {
    const msg = describeError(err);
    await trackAIUsage({
      type: "text_completion",
      model: "failed",
      cost: 0,
      success: false,
      errorMsg: msg.slice(0, 500),
      source: "data_explorer_post_failed",
    });
    throw new Error(`Failed to generate post text. ${msg}`);
  }
}
