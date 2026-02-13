"use client";

import Image from "next/image";
import Link from "next/link";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";

interface TopStoryItemProps {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  imageUrl?: string;
  locale: string;
  rank: number;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export function TopStoryItem({
  id,
  title,
  source,
  timestamp,
  imageUrl,
  locale,
  rank,
}: TopStoryItemProps) {
  return (
    <Link
      href={`/${locale}/post/${id}`}
      className="flex items-start gap-3 py-4 border-b border-gray-100 last:border-b-0 hover:bg-white -mx-2 px-2 rounded-lg transition-colors group"
    >
      {/* Rank Number */}
      <div className="flex-shrink-0 w-8 h-8 bg-ev-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
        {rank}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-ev-green-600 transition-colors text-[15px] leading-snug">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
          <span>{source}</span>
          <span>·</span>
          <span>{formatRelativeTime(timestamp)}</span>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 relative rounded-md overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        <Image
          src={imageUrl || PLACEHOLDER_IMAGE}
          alt={title}
          fill
          className="object-contain"
          sizes="64px"
        />
      </div>
    </Link>
  );
}
