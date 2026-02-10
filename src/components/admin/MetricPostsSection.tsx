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
  Check,
  RotateCcw,
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
  period: number;
  brand: string;
  content: string;
  chartImageUrl: string | null;
  dataSnapshot?: { source?: string; basePeriod?: number } | null;
  status: "DRAFT" | "APPROVED" | "POSTING" | "POSTED" | "FAILED" | "SKIPPED";
  tweetId: string | null;
  postedAt: string | null;
  attempts: number;
  lastError: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MetricPostsStats {
  total: number;
  draft: number;
  approved: number;
  posting: number;
  posted: number;
  failed: number;
  skipped: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    POSTING: "bg-indigo-100 text-indigo-800",
    POSTED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    SKIPPED: "bg-gray-100 text-gray-700",
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
  if (post.dataSnapshot?.source === "data-explorer") {
    const period = post.dataSnapshot.basePeriod ?? post.period;
    const monthName = MONTH_NAMES[period - 1] || "";
    const monthLabel = monthName ? `${monthName} ` : "";
    return `Data Explorer ${monthLabel}${post.year}`;
  }

  if (post.postType === "ALL_BRANDS_COMPARISON") {
    const monthName = MONTH_NAMES[post.period - 1] || "";
    return `All Brands ${monthName} ${post.year}`;
  } else {
    const brandName = BRAND_DISPLAY_NAMES[post.brand] || post.brand;
    const monthName = MONTH_NAMES[post.period - 1] || "";
    return `${brandName} Trend ${monthName} ${post.year}`;
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
    draft: 0,
    approved: 0,
    posting: 0,
    posted: 0,
    failed: 0,
    skipped: 0,
  });
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

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
      await fetchPosts(currentPage);
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
      if (!result.success) {
        throw new Error(result.error || "Failed to post");
      }

      await fetchPosts(currentPage);
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

  async function handleApprove(post: MetricPost) {
    setApprovingIds((prev) => new Set(prev).add(post.id));
    try {
      const res = await fetch(`/api/admin/metric-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve");
      }

      if (data.posted === false && data.error) {
        alert(data.error);
      }

      await fetchPosts(currentPage);
    } catch (err) {
      console.error("Error approving metric post:", err);
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function handleRetry(post: MetricPost) {
    setRetryingIds((prev) => new Set(prev).add(post.id));
    try {
      const res = await fetch(`/api/admin/metric-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retry");
      }

      await fetchPosts(currentPage);
    } catch (err) {
      console.error("Error retrying metric post:", err);
      alert(err instanceof Error ? err.message : "Failed to retry");
    } finally {
      setRetryingIds((prev) => {
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
        {stats.draft > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            {stats.draft} drafts
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
                      const isApproving = approvingIds.has(post.id);
                      const isRetrying = retryingIds.has(post.id);

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
                                <>
                                  {post.status === "DRAFT" && (
                                    <button
                                      onClick={() => handleApprove(post)}
                                      disabled={isApproving || isPosting}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                      title="Approve and post to X immediately"
                                    >
                                      {isApproving ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                      Approve
                                    </button>
                                  )}

                                  {(post.status === "FAILED" ||
                                    post.status === "APPROVED") && (
                                    <button
                                      onClick={() => handleRetry(post)}
                                      disabled={isRetrying || isPosting}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                                      title={post.lastError || "Retry publish"}
                                    >
                                      {isRetrying ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      )}
                                      Retry
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handlePostToX(post)}
                                    disabled={isPosting || post.status === "POSTED"}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ev-green-600 hover:text-ev-green-800 hover:bg-ev-green-50 rounded transition-colors disabled:opacity-50"
                                    title={post.lastError || "Post now"}
                                  >
                                    {isPosting ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                    Post
                                  </button>
                                </>
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
