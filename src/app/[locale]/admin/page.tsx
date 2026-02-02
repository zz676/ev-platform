"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminStats, PostStatus } from "@/components/admin/AdminStats";
import { PostsTable } from "@/components/admin/PostsTable";
import { CreatePostForm } from "@/components/admin/CreatePostForm";
import { Shield, Plus, AlertCircle } from "lucide-react";

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

interface Stats {
  total: number;
  pending: number;
  approved: number;
  published: number;
  xFailed?: number;
}

type XStatusFilter = "all" | "failed" | "published" | "not_posted";

export default function AdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    published: 0,
    xFailed: 0,
  });
  const [maxXAttempts, setMaxXAttempts] = useState(2);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeStatus, setActiveStatus] = useState<PostStatus | undefined>("PENDING");
  const [xStatusFilter, setXStatusFilter] = useState<XStatusFilter>("all");

  const fetchPosts = useCallback(async (status?: PostStatus, xStatus?: XStatusFilter) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (xStatus && xStatus !== "all") params.append("xStatus", xStatus);
      params.append("limit", "50");

      const url = `/api/admin/posts?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch posts");
      const data = await response.json();
      setPosts(data.posts);
      setStats(data.stats);
      if (data.maxXAttempts) setMaxXAttempts(data.maxXAttempts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeStatus, xStatusFilter);
  }, [activeStatus, xStatusFilter, fetchPosts]);

  const handleStatusChange = (status: PostStatus | undefined) => {
    setActiveStatus(status);
  };

  const handleXStatusFilterChange = (filter: XStatusFilter) => {
    setXStatusFilter(filter);
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!response.ok) throw new Error("Failed to approve post");

      // Remove from list and update stats
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setStats((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        approved: prev.approved + 1,
      }));
    } catch (error) {
      console.error("Error approving post:", error);
      throw error;
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (!response.ok) throw new Error("Failed to reject post");

      // Remove from list and update stats
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setStats((prev) => ({
        ...prev,
        pending: prev.pending - 1,
      }));
    } catch (error) {
      console.error("Error rejecting post:", error);
      throw error;
    }
  };

  const handleApproveAll = async () => {
    try {
      const ids = posts.map((p) => p.id);
      const response = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "APPROVED" }),
      });
      if (!response.ok) throw new Error("Failed to approve posts");

      const count = posts.length;
      setPosts([]);
      setStats((prev) => ({
        ...prev,
        pending: 0,
        approved: prev.approved + count,
      }));
    } catch (error) {
      console.error("Error approving all posts:", error);
      throw error;
    }
  };

  const handlePostToX = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/posts/${id}/post-to-x`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        // Update the post's XPublication to show the failure
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  XPublication: {
                    status: "FAILED" as const,
                    attempts: data.attempts || (p.XPublication?.attempts || 0) + 1,
                    lastError: data.error || "Unknown error",
                    tweetId: null,
                    tweetUrl: null,
                  },
                }
              : p
          )
        );
        console.error(`Failed to post to X: ${data.error}`);
        return;
      }

      // Update the post in the list to reflect it's been posted
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                publishedToX: true,
                xPostId: data.tweetId,
                XPublication: {
                  status: "PUBLISHED" as const,
                  attempts: data.attempts || 1,
                  lastError: null,
                  tweetId: data.tweetId,
                  tweetUrl: data.tweetUrl,
                },
              }
            : p
        )
      );
      setStats((prev) => ({
        ...prev,
        published: prev.published + 1,
        xFailed: Math.max(0, (prev.xFailed || 0) - 1), // Decrement failed count if it was a retry
      }));

      // Log success - no popup
      console.log(`Posted to X: ${data.tweetUrl}`);
    } catch (error) {
      console.error("Error posting to X:", error);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    fetchPosts();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6">
      {/* Create Post Modal */}
      {showCreateForm && (
        <CreatePostForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ev-green-100">
              <Shield className="h-5 w-5 text-ev-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500">
                Manage and moderate content
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ev-green-500 rounded-lg hover:bg-ev-green-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <AdminStats
          stats={stats}
          activeStatus={activeStatus}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* X Status Filter */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">X Status:</label>
        <div className="flex items-center gap-2">
          {(
            [
              { value: "all" as const, label: "All", showBadge: false },
              { value: "published" as const, label: "Published", showBadge: false },
              { value: "failed" as const, label: "Failed", showBadge: true },
              { value: "not_posted" as const, label: "Not Posted", showBadge: false },
            ]
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => handleXStatusFilterChange(option.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                xStatusFilter === option.value
                  ? "bg-ev-green-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {option.value === "failed" && (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {option.label}
              {option.showBadge && stats.xFailed !== undefined && stats.xFailed > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  xStatusFilter === option.value
                    ? "bg-white/20 text-white"
                    : "bg-red-100 text-red-700"
                }`}>
                  {stats.xFailed}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Table */}
      <PostsTable
        posts={posts}
        activeStatus={activeStatus}
        onApprove={handleApprove}
        onReject={handleReject}
        onPostToX={handlePostToX}
        onApproveAll={handleApproveAll}
        onRefresh={() => fetchPosts(activeStatus, xStatusFilter)}
        isLoading={isLoading}
        maxXAttempts={maxXAttempts}
      />
    </div>
  );
}
