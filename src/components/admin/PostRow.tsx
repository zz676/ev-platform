"use client";

import { Check, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  translatedTitle: string | null;
  originalTitle: string | null;
  source: string;
  sourceUrl: string;
  sourceDate: string;
  relevanceScore: number;
  status: string;
}

interface PostRowProps {
  post: Post;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isUpdating: boolean;
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

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export function PostRow({ post, onApprove, onReject, isUpdating }: PostRowProps) {
  const title = post.translatedTitle || post.originalTitle || "Untitled";

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="max-w-md">
          <p className="text-sm font-medium text-gray-900 truncate" title={title}>
            {title}
          </p>
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-ev-green-600 mt-1"
          >
            View source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
          {post.source}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatDate(post.sourceDate)}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center px-2 py-1 text-xs font-medium rounded",
            getScoreColor(post.relevanceScore)
          )}
        >
          {post.relevanceScore}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
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
        </div>
      </td>
    </tr>
  );
}
