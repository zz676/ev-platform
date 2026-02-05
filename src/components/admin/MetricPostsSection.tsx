"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  Send,
} from "lucide-react";
import { MetricPostGenerator } from "./MetricPostGenerator";

// Brand display names
const BRAND_DISPLAY_NAMES: Record<string, string> = {
  BYD: "BYD",
  NIO: "NIO",
  XPENG: "XPeng",
  LI_AUTO: "Li Auto",
  ZEEKR: "Zeekr",
  XIAOMI: "Xiaomi",
  TESLA_CHINA: "Tesla China",
  LEAPMOTOR: "Leapmotor",
  GEELY: "Geely",
  OTHER_BRAND: "Other",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MetricPost {
  id: string;
  postType: "BRAND_TREND" | "ALL_BRANDS_COMPARISON";
  year: number;
  period: number | null;
  brand: string | null;
  content: string;
  chartImageUrl: string | null;
  status: "PENDING" | "POSTED" | "FAILED";
  tweetId: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MetricPostsStats {
  total: number;
  pending: number;
  posted: number;
  failed: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    POSTED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getPostTypeLabel(post: MetricPost): string {
  if (post.postType === "ALL_BRANDS_COMPARISON") {
    const monthName = post.period ? MONTH_NAMES[post.period - 1] : "";
    return `All Brands ${monthName} ${post.year}`;
  } else {
    const brandName = post.brand
      ? BRAND_DISPLAY_NAMES[post.brand] || post.brand
      : "";
    return `${brandName} Trend ${post.year}`;
  }
}

function truncateContent(content: string, maxLength: number = 80): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

export function MetricPostsSection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [posts, setPosts] = useState<MetricPost[]>([]);
  const [stats, setStats] = useState<MetricPostsStats>({
    total: 0,
    pending: 0,
    posted: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      const res = await fetch(`/api/admin/metric-posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setPosts(data.posts);
      setStats(data.stats);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error("Error fetching metric posts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      fetchPosts(currentPage);
    }
  }, [isExpanded, currentPage, fetchPosts]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this metric post?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/admin/metric-posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to delete");
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setStats((prev) => ({
        ...prev,
        total: prev.total - 1,
        pending: Math.max(0, prev.pending - 1),
      }));
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handlePostToX(post: MetricPost) {
    setPostingIds((prev) => new Set(prev).add(post.id));
    try {
      const res = await fetch(`/api/admin/metric-posts/${post.id}/post-to-x`, {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to post");
      }

      const result = await res.json();

      // Update post in list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: "POSTED" as const,
                tweetId: result.tweetId,
                postedAt: new Date().toISOString(),
              }
            : p
        )
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        posted: prev.posted + 1,
      }));
    } catch (err) {
      console.error("Error posting to X:", err);
      alert(err instanceof Error ? err.message : "Failed to post to X");
    } finally {
      setPostingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  }

  const getTweetUrl = (tweetId: string | null): string | null => {
    if (!tweetId) return null;
    return `https://x.com/i/status/${tweetId}`;
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <ChevronUp className="h-5 w-5" />
        )}
        <BarChart3 className="h-5 w-5 text-ev-green-600" />
        Metric Posts
        {stats.pending > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            {stats.pending} pending
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-4">
          {/* Generator */}
          <MetricPostGenerator onPostSaved={() => fetchPosts(1)} />

          {/* Posts Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Recent Posts</h3>
              <button
                onClick={() => fetchPosts(currentPage)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {/* Table */}
            {loading && posts.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
                <p>Loading posts...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-900">No metric posts yet</p>
                <p className="text-sm mt-1">
                  Generate a post above to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type / Period
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Content Preview
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {posts.map((post) => {
                      const tweetUrl = getTweetUrl(post.tweetId);
                      const isDeleting = deletingIds.has(post.id);
                      const isPosting = postingIds.has(post.id);

                      return (
                        <tr key={post.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-ev-green-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {getPostTypeLabel(post)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={post.status} />
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-sm text-gray-600 max-w-xs block truncate"
                              title={post.content}
                            >
                              {truncateContent(post.content)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(post.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {tweetUrl ? (
                                <a
                                  href={tweetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View
                                </a>
                              ) : (
                                <button
                                  onClick={() => handlePostToX(post)}
                                  disabled={isPosting || post.status === "POSTED"}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ev-green-600 hover:text-ev-green-800 hover:bg-ev-green-50 rounded transition-colors disabled:opacity-50"
                                >
                                  {isPosting ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                  Post
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(post.id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
