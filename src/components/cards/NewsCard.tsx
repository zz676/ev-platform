"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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
      <div className="pt-2 px-4 pb-4">
        {/* Date */}
        <div className="flex justify-end mb-2">
          <span className="text-xs text-gray-500">
            {formatRelativeTime(timestamp)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[0.9rem] font-semibold text-gray-900 line-clamp-2 group-hover:text-ev-green-600 transition-colors">
          <Link href={`/${locale}/post/${id}`}>{title}</Link>
        </h3>
      </div>
    </article>
  );
}
