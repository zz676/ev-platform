"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminStats } from "@/components/admin/AdminStats";
import { PostsTable } from "@/components/admin/PostsTable";
import { CreatePostForm } from "@/components/admin/CreatePostForm";
import { Shield, Plus } from "lucide-react";

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

interface Stats {
  total: number;
  pending: number;
  approved: number;
  published: number;
}

export default function AdminPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    published: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/posts?status=PENDING&limit=50");
      if (!response.ok) throw new Error("Failed to fetch posts");
      const data = await response.json();
      setPosts(data.posts);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
        <AdminStats stats={stats} />
      </div>

      {/* Posts Table */}
      <PostsTable
        posts={posts}
        onApprove={handleApprove}
        onReject={handleReject}
        onApproveAll={handleApproveAll}
        onRefresh={fetchPosts}
        isLoading={isLoading}
      />
    </div>
  );
}
