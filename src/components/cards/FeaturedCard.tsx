"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

interface FeaturedCardProps {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  timestamp: string;
  imageUrl?: string;
  relevanceScore?: number;
  locale: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function FeaturedCard({
  id,
  title,
  summary,
  category,
  source,
  timestamp,
  imageUrl,
  relevanceScore,
  locale,
}: FeaturedCardProps) {
  const isImportant = relevanceScore && relevanceScore >= 90;

  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Large Featured Image */}
      <div className="relative aspect-video bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 65vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {isImportant && (
          <div className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Category */}
        <div className="mb-3">
          <CategoryBadge category={category} />
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-ev-green-600 transition-colors leading-tight">
          <Link href={`/${locale}/post/${id}`}>{title}</Link>
        </h2>

        {/* Summary */}
        <p className="text-lg text-gray-600 mb-4 line-clamp-3">{summary}</p>

        {/* Footer */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{source}</span>
          <span>·</span>
          <span>{formatRelativeTime(timestamp)}</span>
        </div>
      </div>
    </article>
  );
}
