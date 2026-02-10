import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { generateDataExplorerPostFromPrompt } from "@/lib/llm/data-explorer-post";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (prompt.trim().length < 20) {
      return NextResponse.json(
        { error: "prompt is too short" },
        { status: 400 }
      );
    }

    if (prompt.length > 20_000) {
      return NextResponse.json(
        { error: "prompt is too long" },
        { status: 400 }
      );
    }

    const content = await generateDataExplorerPostFromPrompt(prompt);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error generating data explorer post:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate post";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

