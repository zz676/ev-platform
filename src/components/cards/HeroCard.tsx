"use client";

import Image from "next/image";
import Link from "next/link";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";

interface HeroCardProps {
  id: string;
  title: string;
  category: string;
  source: string;
  timestamp: string;
  imageUrl?: string;
  locale: string;
  size: "large" | "small";
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

export function HeroCard({
  id,
  title,
  category,
  source,
  timestamp,
  imageUrl,
  locale,
  size,
}: HeroCardProps) {
  const isLarge = size === "large";

  return (
    <Link
      href={`/${locale}/post/${id}`}
      className={`relative block overflow-hidden rounded-xl group ${
        isLarge ? "h-[500px]" : "h-[120px]"
      }`}
    >
      {/* Background Image */}
      <div className="absolute inset-0 bg-gray-800">
        <Image
          src={imageUrl || PLACEHOLDER_IMAGE}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes={isLarge ? "(max-width: 768px) 100vw, 50vw" : "25vw"}
          priority={isLarge}
        />
      </div>

      {/* Dark Gradient Overlay */}
      <div
        className={`absolute inset-0 ${
          isLarge
            ? "bg-gradient-to-t from-black/90 via-black/40 to-transparent"
            : "bg-gradient-to-t from-black/80 via-black/30 to-transparent"
        }`}
      />

      {/* Content */}
      <div
        className={`absolute inset-x-0 bottom-0 ${
          isLarge ? "p-6" : "p-3"
        }`}
      >
        {/* Category Badge */}
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide mb-2 ${
            isLarge ? "bg-ev-green-500 text-white" : "bg-white/20 text-white/90"
          }`}
        >
          {category}
        </span>

        {/* Title */}
        <h2
          className={`font-bold text-white leading-tight group-hover:text-ev-green-300 transition-colors ${
            isLarge
              ? "text-2xl md:text-3xl line-clamp-3"
              : "text-sm line-clamp-2"
          }`}
        >
          {title}
        </h2>

        {/* Source + Time */}
        <div
          className={`flex items-center gap-2 text-white/70 ${
            isLarge ? "mt-3 text-sm" : "mt-1.5 text-xs"
          }`}
        >
          <span className="font-medium">{source}</span>
          <span>·</span>
          <span>{formatRelativeTime(timestamp)}</span>
        </div>
      </div>
    </Link>
  );
}
