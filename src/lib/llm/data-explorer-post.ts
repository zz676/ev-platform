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
const DISABLE_DEEPSEEK = process.env.DISABLE_DEEPSEEK === "true";

// Text completion pricing (per 1M tokens)
const TEXT_COMPLETION_COST = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
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
  if (err instanceof Error) return `${err.name} ${err.message}`;
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

async function callDeepSeek(prompt: string): Promise<string> {
  const { provider, client } = getProvider("deepseek");
  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 350,
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("DeepSeek returned empty response");

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  await trackAIUsage({
    type: "text_completion",
    model: provider.model,
    cost: calculateTextCost(provider.model, inputTokens, outputTokens),
    success: true,
    source: "data_explorer_post_deepseek",
    inputTokens,
    outputTokens,
  });

  return content;
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const { client } = getProvider("openai");
  const response = await client.chat.completions.create({
    model,
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
    model,
    cost: calculateTextCost(model, inputTokens, outputTokens),
    success: true,
    source: "data_explorer_post_openai",
    inputTokens,
    outputTokens,
  });

  return content;
}

export async function generateDataExplorerPostFromPrompt(prompt: string): Promise<string> {
  const deepseekEnabled = !DISABLE_DEEPSEEK && !!process.env.DEEPSEEK_API_KEY;
  if (deepseekEnabled) {
    try {
      return await callDeepSeek(prompt);
    } catch (err) {
      console.warn(`[DataExplorerPost] DeepSeek failed: ${describeError(err)}. Falling back to GPT-4o-mini...`);
    }
  }

  try {
    return await callOpenAI(prompt, "gpt-4o-mini");
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

