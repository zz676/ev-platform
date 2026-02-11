import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth/api-auth";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) return authResult.error;

  const userId = authResult.user.id;
  const { id } = await context.params;

  const key = await prisma.apiKey.findUnique({
    where: { id },
    select: { id: true, userId: true, isActive: true },
  });

  if (!key || key.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!key.isActive) {
    return NextResponse.json({ success: true, message: "Key already revoked" });
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date() },
    select: { id: true },
  });

  return NextResponse.json({ success: true });
}

