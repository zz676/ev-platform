import { NextResponse } from "next/server";
import { MetricPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/auth/api-auth";
import { publishMetricPost } from "@/lib/metric-posts/publish";

type Action = "approve" | "unapprove" | "retry" | "skip";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAdmin();
  if ("error" in authResult) {
    return authResult.error;
  }

  const { id } = await params;

  let action: Action = "approve";
  try {
    const body = await request.json();
    action = body?.action || action;
  } catch {
    // Allow empty body for simple approve action
  }

  const metricPost = await prisma.metricPost.findUnique({ where: { id } });
  if (!metricPost) {
    return NextResponse.json({ error: "Metric post not found" }, { status: 404 });
  }

  if (metricPost.status === MetricPostStatus.POSTED) {
    return NextResponse.json(
      { error: "Metric post already posted" },
      { status: 409 }
    );
  }

  if (action === "unapprove") {
    const updated = await prisma.metricPost.update({
      where: { id },
      data: {
        status: MetricPostStatus.DRAFT,
        approvedAt: null,
        approvedBy: null,
        lastError: null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, post: updated });
  }

  if (action === "skip") {
    const updated = await prisma.metricPost.update({
      where: { id },
      data: {
        status: MetricPostStatus.SKIPPED,
        approvedAt: null,
        approvedBy: null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, post: updated });
  }

  // approve / retry
  const approvedBy = authResult.user.email;

  const approved = await prisma.metricPost.update({
    where: { id },
    data: {
      status: MetricPostStatus.APPROVED,
      approvedAt: new Date(),
      approvedBy,
      lastError: null,
      updatedAt: new Date(),
    },
  });

  const publishResult = await publishMetricPost({
    id,
    expectedStatuses: [MetricPostStatus.APPROVED],
    approvedBy,
  });

  // Approve succeeded regardless of publish result; publish can fail transiently.
  return NextResponse.json({
    success: true,
    action,
    approved: true,
    posted: publishResult.ok && publishResult.status === MetricPostStatus.POSTED,
    status: publishResult.status,
    tweetId: publishResult.tweetId,
    tweetUrl: publishResult.tweetUrl,
    chartUrl: publishResult.chartUrl,
    error: publishResult.ok ? null : publishResult.error || publishResult.reason,
    post: approved,
  });
}

