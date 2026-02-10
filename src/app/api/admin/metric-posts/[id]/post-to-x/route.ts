import { NextResponse } from "next/server";
import { MetricPostStatus } from "@prisma/client";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { publishMetricPost } from "@/lib/metric-posts/publish";

// POST: Post metric post to X with chart image
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const { id } = await params;

    // Parse optional custom content from request body
    let customText: string | undefined;
    let chartImageBase64: string | undefined;
    try {
      const body = await request.json();
      customText = body.text;
      chartImageBase64 = body.chartImageBase64;
    } catch {
      // No body - use existing content
    }

    const result = await publishMetricPost({
      id,
      expectedStatuses: [
        MetricPostStatus.DRAFT,
        MetricPostStatus.APPROVED,
        MetricPostStatus.FAILED,
        MetricPostStatus.SKIPPED,
      ],
      overrideText: customText,
      overrideChartImageBase64: chartImageBase64,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || result.reason || "Failed to post to X", status: result.status },
        { status: result.skipped ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      chartUrl: result.chartUrl,
      status: result.status,
      skipped: result.skipped || false,
      reason: result.reason,
    });
  } catch (error) {
    console.error("Error posting metric post to X:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to post to X: ${errorMessage}` },
      { status: 500 }
    );
  }
}
