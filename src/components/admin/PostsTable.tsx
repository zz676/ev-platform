"use client";

import { useState } from "react";
import { PostRow } from "./PostRow";
import { RefreshCw, CheckCircle2 } from "lucide-react";
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
  relevanceScore: number;
  status: string;
  publishedToX?: boolean;
  xPostId?: string | null;
  XPublication?: XPublication | null;
}

interface PostsTableProps {
  posts: Post[];
  activeStatus?: PostStatus;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onPostToX?: (id: string) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
  maxXAttempts?: number;
}

const getStatusTitle = (status?: PostStatus): string => {
  if (!status) return "All Posts";
  const titles: Record<PostStatus, string> = {
    PENDING: "Pending Posts",
    APPROVED: "Approved Posts",
    PUBLISHED: "Published Posts",
  };
  return titles[status];
};

const getEmptyMessage = (status?: PostStatus): { title: string; subtitle: string } => {
  if (!status) return { title: "No posts", subtitle: "No posts found." };
  const messages: Record<PostStatus, { title: string; subtitle: string }> = {
    PENDING: { title: "All caught up!", subtitle: "No pending posts to review." },
    APPROVED: { title: "No approved posts", subtitle: "Approve some posts to see them here." },
    PUBLISHED: { title: "No published posts", subtitle: "Post approved content to X to see them here." },
  };
  return messages[status];
};

export function PostsTable({
  posts,
  activeStatus,
  onApprove,
  onReject,
  onPostToX,
  onApproveAll,
  onRefresh,
  isLoading,
  maxXAttempts = 2,
}: PostsTableProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [postingToXIds, setPostingToXIds] = useState<Set<string>>(new Set());
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const handleApprove = async (id: string) => {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await onApprove(id);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async (id: string) => {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await onReject(id);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    try {
      await onApproveAll();
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handlePostToX = async (id: string) => {
    if (!onPostToX) return;
    setPostingToXIds((prev) => new Set(prev).add(id));
    try {
      await onPostToX(id);
    } finally {
      setPostingToXIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">{getStatusTitle(activeStatus)}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {activeStatus === "PENDING" && posts.length > 0 && (
            <button
              onClick={handleApproveAll}
              disabled={isApprovingAll || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve All ({posts.length})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading && posts.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
          <p>Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-12 text-center text-gray-500">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-gray-900">{getEmptyMessage(activeStatus).title}</p>
          <p className="text-sm mt-1">{getEmptyMessage(activeStatus).subtitle}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  X Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  activeStatus={activeStatus}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPostToX={onPostToX ? handlePostToX : undefined}
                  isUpdating={updatingIds.has(post.id)}
                  isPostingToX={postingToXIds.has(post.id)}
                  maxXAttempts={maxXAttempts}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
