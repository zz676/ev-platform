"use client";

import { Check, X, ExternalLink, Share2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostStatus } from "./AdminStats";

interface XPublication {
  status: "PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "SKIPPED";
  attempts: number;
  lastError: string | null;
  tweetId: string | null;
  tweetUrl: string | null;
}

interface Post {
  id: string;
  translatedTitle: string | null;
  originalTitle: string | null;
  source: string;
  sourceUrl: string;
  sourceDate: string;
  createdAt: string;
  relevanceScore: number;
  status: string;
  publishedToX?: boolean;
  xPostId?: string | null;
  XPublication?: XPublication | null;
  publishedToDiscord?: boolean;
}

interface PostRowProps {
  post: Post;
  activeStatus?: PostStatus;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onOpenPreview: (postId: string, platform: "x" | "discord") => void;
  showPostToX?: boolean;
  showPostToDiscord?: boolean;
  isUpdating: boolean;
  isPostingToX?: boolean;
  isPostingToDiscord?: boolean;
  maxXAttempts?: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export function PostRow({ post, activeStatus, onApprove, onReject, onOpenPreview, showPostToX, showPostToDiscord, isUpdating, isPostingToX, isPostingToDiscord, maxXAttempts = 2 }: PostRowProps) {
  const title = post.translatedTitle || post.originalTitle || "Untitled";
  const xPub = post.XPublication;
  const isXFailed = xPub?.status === "FAILED";
  const isXPublished = xPub?.status === "PUBLISHED" || post.publishedToX;
  const isDiscordPublished = post.publishedToDiscord;

  // Can post to X if: approved status AND (not published OR failed with retry allowed)
  const canPostToX =
    (post.status === "APPROVED" || post.status === "PUBLISHED") &&
    !isXPublished &&
    showPostToX;

  // Can post to Discord if: approved/published AND not already posted
  const canPostToDiscord =
    (post.status === "APPROVED" || post.status === "PUBLISHED") &&
    !isDiscordPublished &&
    showPostToDiscord;

  // Show approve/reject when filtering pending OR when showing all and post is pending
  const showApproveReject = activeStatus === "PENDING" || (!activeStatus && post.status === "PENDING");

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="max-w-md">
          <p className="text-sm font-medium text-gray-900 truncate" title={title}>
            {title}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <a
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 hover:text-ev-green-600 transition-colors"
        >
          {post.source}
          <ExternalLink className="h-3 w-3" />
        </a>
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-500">
        {formatDate(post.sourceDate)}
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-500">
        {formatShortDate(post.createdAt)}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={cn(
            "inline-flex items-center px-2 py-1 text-xs font-medium rounded",
            getScoreColor(post.relevanceScore)
          )}
        >
          {post.relevanceScore}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {/* X Status indicator */}
        {isXPublished ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
            <Check className="h-3 w-3" />
            Published
          </span>
        ) : isXFailed ? (
          <div className="relative group inline-block">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded cursor-help">
              <AlertCircle className="h-3 w-3" />
              Failed ({xPub?.attempts || 0}/{maxXAttempts})
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50 max-w-xs break-words">
              {xPub?.lastError || "Publishing failed"}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        ) : xPub?.status === "PENDING" || xPub?.status === "PUBLISHING" ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pending
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded">
            -
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {/* Discord Status indicator */}
        {isDiscordPublished ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
            <Check className="h-3 w-3" />
            Published
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded">
            -
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          {showApproveReject && (
            <>
              <button
                onClick={() => onApprove(post.id)}
                disabled={isUpdating}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                onClick={() => onReject(post.id)}
                disabled={isUpdating}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </>
          )}
          {canPostToX && (
            <div className="relative group inline-block">
              <button
                onClick={() => onOpenPreview(post.id, "x")}
                disabled={isPostingToX}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50",
                  isXFailed
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-blue-500 hover:bg-blue-600"
                )}
              >
                {isPostingToX ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {isPostingToX ? "Posting..." : isXFailed ? "Retry X" : "Post to X"}
              </button>
              {isXFailed && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50 max-w-xs break-words">
                  {xPub?.lastError || "Previous attempt failed"}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          )}
          {isXPublished && (xPub?.tweetUrl || post.xPostId) && (
            <a
              href={xPub?.tweetUrl || `https://x.com/i/status/${post.xPostId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {canPostToDiscord && (
            <button
              onClick={() => onOpenPreview(post.id, "discord")}
              disabled={isPostingToDiscord}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPostingToDiscord ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {isPostingToDiscord ? "Posting..." : "Post to Discord"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
