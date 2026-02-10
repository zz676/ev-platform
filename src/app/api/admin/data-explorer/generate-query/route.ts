import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import {
  generateQueryFromQuestion,
  LLMUnavailableError,
  SUGGESTED_QUESTIONS,
} from "@/lib/llm/query-generator";
import { getAllowedTables } from "@/lib/query-executor";

// POST: Generate query from natural language question
export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (question.trim().length < 3) {
      return NextResponse.json(
        { error: "Question is too short" },
        { status: 400 }
      );
    }

    const result = await generateQueryFromQuestion(question);

    return NextResponse.json({
      table: result.table,
      query: result.query,
      chartType: result.chartType,
      chartTitle: result.chartTitle,
      explanation: result.explanation,
    });
  } catch (error) {
    console.error("Error generating query:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate query";
    if (error instanceof LLMUnavailableError) {
      return NextResponse.json({ error: errorMessage }, { status: 503 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET: Get available tables and suggested questions
export async function GET() {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const tables = getAllowedTables();

    return NextResponse.json({
      tables,
      suggestedQuestions: SUGGESTED_QUESTIONS,
    });
  } catch (error) {
    console.error("Error fetching options:", error);
    return NextResponse.json(
      { error: "Failed to fetch options" },
      { status: 500 }
    );
  }
}
