"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { NewsCard } from "@/components/cards/NewsCard";

type Post = {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  sourceUrl: string;
  timestamp: Date;
  imageUrl?: string;
  relevanceScore: number;
};

type MoreNewsSectionProps = {
  initialPosts: Post[];
  locale: string;
  totalInitialPosts: number; // Total posts loaded on initial page (e.g., 20)
  initialHasMore: boolean; // Whether there are more posts to load
};

export function MoreNewsSection({
  initialPosts,
  locale,
  totalInitialPosts,
  initialHasMore,
}: MoreNewsSectionProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [skip, setSkip] = useState(totalInitialPosts); // Skip posts already shown
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const limit = 6;

  const loadMore = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      // Use skip-based pagination directly
      const url = `/api/posts?skip=${skip}&limit=${limit}&lang=${locale}`;
      console.log("[MoreNews] Fetching:", url);
      const res = await fetch(url);
      const data = await res.json();
      console.log("[MoreNews] Response:", { postsCount: data.posts?.length, pagination: data.pagination });

      if (data.posts && data.posts.length > 0) {
        const newPosts: Post[] = data.posts.map(
          (post: {
            id: string;
            title: string;
            summary: string;
            categories: string[];
            author: string;
            sourceUrl: string;
            date: string;
            mediaUrls: string[];
            relevanceScore: number;
          }) => ({
            id: post.id,
            title: post.title || "Untitled",
            summary: post.summary || "",
            category: post.categories?.[0] || "News",
            source: post.author,
            sourceUrl: post.sourceUrl,
            timestamp: new Date(post.date),
            imageUrl: post.mediaUrls?.[0],
            relevanceScore: post.relevanceScore,
          })
        );
        setPosts((prev) => [...prev, ...newPosts]);
        setSkip((prev) => prev + newPosts.length);
        setHasMore(data.pagination?.hasMore ?? false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Newspaper className="h-5 w-5 text-gray-400" />
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => (
          <NewsCard
            key={post.id}
            id={post.id}
            title={post.title}
            summary={post.summary}
            category={post.category}
            source={post.source}
            sourceUrl={post.sourceUrl}
            timestamp={post.timestamp}
            imageUrl={post.imageUrl}
            relevanceScore={post.relevanceScore}
            locale={locale}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="relative px-2 py-1 text-sm font-semibold tracking-widest text-lime-500 hover:text-lime-400 transition-colors duration-300 disabled:opacity-50"
          >
            <span className="relative">
              {loading ? "LOADING..." : "MORE"}
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-lime-500" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
