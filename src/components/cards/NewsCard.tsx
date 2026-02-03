"use client";

import Image from "next/image";
import Link from "next/link";
import { Share2, ExternalLink, Sparkles } from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { cn } from "@/lib/utils";

interface NewsCardProps {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  sourceUrl: string;
  timestamp: Date;
  imageUrl?: string;
  relevanceScore?: number;
  locale: string;
}

function formatRelativeTime(date: Date): string {
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

export function NewsCard({
  id,
  title,
  summary,
  category,
  source,
  sourceUrl,
  timestamp,
  imageUrl,
  relevanceScore,
  locale,
}: NewsCardProps) {
  const isImportant = relevanceScore && relevanceScore >= 90;

  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Image */}
      {imageUrl && (
        <div className="relative h-40 bg-gray-100">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {isImportant && (
            <div className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Category and time */}
        <div className="flex items-center gap-2 mb-2">
          <CategoryBadge category={category} />
          <span className="text-xs text-gray-500">
            {formatRelativeTime(timestamp)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-ev-green-600 transition-colors">
          <Link href={`/${locale}/post/${id}`}>{title}</Link>
        </h3>

        {/* Summary */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{summary}</p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">Source: {source}</span>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4 text-gray-400" />
            </button>
            <Link
              href={`/${locale}/post/${id}`}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded",
                "bg-ev-green-50 text-ev-green-700 hover:bg-ev-green-100 transition-colors"
              )}
            >
              READ FULL
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
