"use client";

import Image from "next/image";
import Link from "next/link";

interface SideNewsCardProps {
  id: string;
  title: string;
  summary: string;
  category: string;
  source: string;
  timestamp: string;
  imageUrl?: string;
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

export function SideNewsCard({
  id,
  title,
  summary,
  category,
  source,
  timestamp,
  imageUrl,
  locale,
}: SideNewsCardProps) {
  return (
    <Link
      href={`/${locale}/post/${id}`}
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
    >
      {/* Image */}
      <div className="relative h-[120px] bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="250px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg
              className="w-10 h-10 text-gray-300"
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
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-ev-green-600 transition-colors mb-2">
          {title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-gray-500 line-clamp-3 mb-3">{summary}</p>

        {/* Category + Time */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-ev-green-50 text-ev-green-700 rounded font-medium uppercase tracking-wide">
            {category}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-400">{formatRelativeTime(timestamp)}</span>
        </div>
      </div>
    </Link>
  );
}
