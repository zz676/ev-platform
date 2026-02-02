import { prisma } from "@/lib/prisma";
import { XPublishStatus, ImageSource } from "@prisma/client";
import crypto from "crypto";

// Maximum auto-publish attempts before requiring manual intervention
// Configurable via X_MAX_PUBLISH_ATTEMPTS env var (default: 2)
export const MAX_ATTEMPTS = parseInt(process.env.X_MAX_PUBLISH_ATTEMPTS || "2", 10);

/**
 * Check if auto-publish should attempt for a post
 * Used by cron job to decide if it should try publishing
 */
export async function canAttemptPublish(postId: string): Promise<{
  allowed: boolean;
  reason?: string;
  xPublication?: { attempts: number; status: XPublishStatus };
}> {
  const xPub = await prisma.xPublication.findUnique({
    where: { postId },
  });

  if (!xPub) {
    return { allowed: true };
  }

  if (xPub.status === XPublishStatus.PUBLISHED) {
    return {
      allowed: false,
      reason: "Already published",
      xPublication: { attempts: xPub.attempts, status: xPub.status },
    };
  }

  if (xPub.attempts >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      reason: `Max attempts (${MAX_ATTEMPTS}) reached`,
      xPublication: { attempts: xPub.attempts, status: xPub.status },
    };
  }

  return {
    allowed: true,
    xPublication: { attempts: xPub.attempts, status: xPub.status },
  };
}

/**
 * Check if manual retry is allowed for a post
 * Manual retry is always allowed unless already published
 */
export async function canManualRetry(postId: string): Promise<{
  allowed: boolean;
  reason?: string;
  xPublication?: { attempts: number; status: XPublishStatus };
}> {
  const xPub = await prisma.xPublication.findUnique({
    where: { postId },
  });

  if (!xPub) {
    return { allowed: true };
  }

  if (xPub.status === XPublishStatus.PUBLISHED) {
    return {
      allowed: false,
      reason: "Already published",
      xPublication: { attempts: xPub.attempts, status: xPub.status },
    };
  }

  // Manual retry always allowed for non-published posts
  return {
    allowed: true,
    xPublication: { attempts: xPub.attempts, status: xPub.status },
  };
}

/**
 * Record the start of a publishing attempt
 * Creates XPublication record if it doesn't exist
 */
export async function startPublishingAttempt(
  postId: string,
  options?: { isManualRetry?: boolean }
): Promise<{ id: string; attempts: number }> {
  const existing = await prisma.xPublication.findUnique({
    where: { postId },
  });

  if (existing) {
    // Update existing record
    const updated = await prisma.xPublication.update({
      where: { postId },
      data: {
        status: XPublishStatus.PUBLISHING,
        attempts: existing.attempts + 1,
        lastError: null,
        updatedAt: new Date(),
      },
    });
    return { id: updated.id, attempts: updated.attempts };
  }

  // Create new record
  const created = await prisma.xPublication.create({
    data: {
      id: crypto.randomBytes(12).toString("hex"),
      postId,
      status: XPublishStatus.PUBLISHING,
      attempts: 1,
      updatedAt: new Date(),
    },
  });
  return { id: created.id, attempts: created.attempts };
}

/**
 * Record a successful publish
 */
export async function recordPublishSuccess(
  postId: string,
  data: {
    tweetId: string;
    imageSource: ImageSource;
    mediaId?: string;
  }
): Promise<void> {
  await prisma.xPublication.update({
    where: { postId },
    data: {
      status: XPublishStatus.PUBLISHED,
      tweetId: data.tweetId,
      tweetUrl: `https://x.com/i/status/${data.tweetId}`,
      publishedAt: new Date(),
      imageSource: data.imageSource,
      mediaId: data.mediaId,
      lastError: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Record a failed publish attempt
 */
export async function recordPublishFailure(
  postId: string,
  error: string
): Promise<{ attempts: number; maxReached: boolean }> {
  const xPub = await prisma.xPublication.update({
    where: { postId },
    data: {
      status: XPublishStatus.FAILED,
      lastError: error.slice(0, 500), // Truncate long errors
      updatedAt: new Date(),
    },
  });

  return {
    attempts: xPub.attempts,
    maxReached: xPub.attempts >= MAX_ATTEMPTS,
  };
}

/**
 * Get posts that have failed to publish (for admin panel)
 */
export async function getFailedPublications() {
  return prisma.xPublication.findMany({
    where: {
      status: XPublishStatus.FAILED,
    },
    include: {
      Post: {
        select: {
          id: true,
          translatedTitle: true,
          originalTitle: true,
          status: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

/**
 * Get X publication status for a post
 */
export async function getXPublicationStatus(postId: string) {
  return prisma.xPublication.findUnique({
    where: { postId },
    select: {
      status: true,
      attempts: true,
      lastError: true,
      tweetId: true,
      tweetUrl: true,
      publishedAt: true,
    },
  });
}

/**
 * Check if image upload has previously failed for a post
 * This helps avoid wasting API calls on known-bad images
 */
export async function hasImageFailed(postId: string): Promise<boolean> {
  const xPub = await prisma.xPublication.findUnique({
    where: { postId },
    select: { imageSource: true },
  });

  return xPub?.imageSource === ImageSource.FAILED;
}
