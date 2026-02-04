"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminStats, PostStatus } from "@/components/admin/AdminStats";
import { PostsTable, SortColumn, SortOrder } from "@/components/admin/PostsTable";
import { DigestsTable } from "@/components/admin/DigestsTable";
import { CreatePostForm } from "@/components/admin/CreatePostForm";
import { Shield, Plus, AlertCircle, Search, X, ChevronDown, ChevronRight } from "lucide-react";

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

interface Stats {
  total: number;
  pending: number;
  approved: number;
  published: number;
  xFailed?: number;
}

interface Digest {
  id: string;
  scheduledFor: string;
  content: string;
  postIds: string[];
  topPostId: string;
  status: string;
  postedAt: string | null;
  tweetId: string | null;
  createdAt: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortColumn>("relevanceScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Digests state
  const [digests, setDigests] = useState<Digest[]>([]);
  const [digestsLoading, setDigestsLoading] = useState(false);
  const [digestsExpanded, setDigestsExpanded] = useState(true);
  const [digestsPage, setDigestsPage] = useState(1);
  const [digestsTotalPages, setDigestsTotalPages] = useState(1);

  const fetchPosts = useCallback(async (
    status?: PostStatus,
    xStatus?: XStatusFilter,
    search?: string,
    page: number = 1,
    sort: SortColumn = "relevanceScore",
    order: SortOrder = "desc"
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (xStatus && xStatus !== "all") params.append("xStatus", xStatus);
      if (search) params.append("search", search);
      params.append("page", page.toString());
      params.append("limit", "20");
      params.append("sortBy", sort);
      params.append("sortOrder", order);

      const url = `/api/admin/posts?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch posts");
      const data = await response.json();
      setPosts(data.posts);
      setStats(data.stats);
      if (data.maxXAttempts) setMaxXAttempts(data.maxXAttempts);
      if (data.pagination) {
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDigests = useCallback(async (page: number = 1) => {
    setDigestsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "10");

      const response = await fetch(`/api/admin/digests?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch digests");
      const data = await response.json();
      setDigests(data.digests);
      if (data.pagination) {
        setDigestsPage(data.pagination.page);
        setDigestsTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching digests:", error);
    } finally {
      setDigestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeStatus, xStatusFilter, searchQuery, currentPage, sortBy, sortOrder);
  }, [activeStatus, xStatusFilter, searchQuery, currentPage, sortBy, sortOrder, fetchPosts]);

  useEffect(() => {
    fetchDigests(digestsPage);
  }, [digestsPage, fetchDigests]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleStatusChange = (status: PostStatus | undefined) => {
    setActiveStatus(status);
    setCurrentPage(1);
  };

  const handleXStatusFilterChange = (filter: XStatusFilter) => {
    setXStatusFilter(filter);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSortChange = (column: SortColumn) => {
    if (column === sortBy) {
      // Toggle order if same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
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

  // Called after successful post from modal - just update local state
  const handlePostToXSuccess = (id: string) => {
    // Update the post in the list to reflect it's been posted
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              publishedToX: true,
              XPublication: {
                status: "PUBLISHED" as const,
                attempts: (p.XPublication?.attempts || 0) + 1,
                lastError: null,
                tweetId: null, // We don't have the tweetId from the modal callback
                tweetUrl: null,
              },
            }
          : p
      )
    );
    setStats((prev) => ({
      ...prev,
      published: prev.published + 1,
      xFailed: Math.max(0, (prev.xFailed || 0) - 1),
    }));
    console.log(`Posted to X successfully`);
  };

  // Called after successful post from modal - just update local state
  const handlePostToDiscordSuccess = (id: string) => {
    // Update the post in the list to reflect it's been posted to Discord
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              publishedToDiscord: true,
            }
          : p
      )
    );
    console.log(`Posted to Discord successfully`);
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    fetchPosts();
  };

  const handleDeleteDigest = async (id: string) => {
    try {
      const response = await fetch("/api/admin/digests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete digest");

      // Remove from list
      setDigests((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error deleting digest:", error);
      throw error;
    }
  };

  const handleEditDigest = async (id: string, content: string) => {
    try {
      const response = await fetch("/api/admin/digests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });
      if (!response.ok) throw new Error("Failed to update digest");

      // Update in list
      setDigests((prev) =>
        prev.map((d) => (d.id === id ? { ...d, content } : d))
      );
    } catch (error) {
      console.error("Error updating digest:", error);
      throw error;
    }
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

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts by title..."
              className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ev-green-500 focus:border-transparent"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>

        {/* X Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">X Status:</label>
          <div className="flex items-center gap-1">
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
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  xStatusFilter === option.value
                    ? "bg-ev-green-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {option.value === "failed" && (
                  <AlertCircle className="h-3 w-3" />
                )}
                {option.label}
                {option.showBadge && stats.xFailed !== undefined && stats.xFailed > 0 && (
                  <span className={`ml-1 px-1 py-0.5 text-xs rounded-full ${
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
      </div>

      {/* Active search indicator */}
      {searchQuery && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>Searching for: <strong>&quot;{searchQuery}&quot;</strong></span>
          <button
            onClick={clearSearch}
            className="text-ev-green-600 hover:text-ev-green-700 underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Posts Table */}
      <PostsTable
        posts={posts}
        activeStatus={activeStatus}
        onApprove={handleApprove}
        onReject={handleReject}
        onPostToX={handlePostToXSuccess}
        onPostToDiscord={handlePostToDiscordSuccess}
        onApproveAll={handleApproveAll}
        onRefresh={() => fetchPosts(activeStatus, xStatusFilter, searchQuery, currentPage, sortBy, sortOrder)}
        isLoading={isLoading}
        maxXAttempts={maxXAttempts}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />

      {/* Daily Digests Section */}
      <div className="mt-8">
        <button
          onClick={() => setDigestsExpanded(!digestsExpanded)}
          className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
        >
          {digestsExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
          Daily Digests
        </button>

        {digestsExpanded && (
          <DigestsTable
            digests={digests}
            onDelete={handleDeleteDigest}
            onEdit={handleEditDigest}
            onRefresh={() => fetchDigests(digestsPage)}
            isLoading={digestsLoading}
            currentPage={digestsPage}
            totalPages={digestsTotalPages}
            onPageChange={setDigestsPage}
          />
        )}
      </div>

    </div>
  );
}
