"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";

// Brand logos mapping
const brandLogos: Record<string, string> = {
  NIO: "/images/brands/nio.svg",
  XPENG: "/images/brands/xpeng.svg",
  "LI AUTO": "/images/brands/li-auto.svg",
  BYD: "/images/brands/byd.svg",
  TESLA: "/images/brands/tesla.svg",
};

// Get brand logo from category
function getBrandLogo(category: string): string | null {
  const normalizedCategory = category.toUpperCase();
  return brandLogos[normalizedCategory] || null;
}

interface NewsCardProps {
  id: string;
  title: string;
  category: string;
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
  category,
  timestamp,
  imageUrl,
  relevanceScore,
  locale,
}: NewsCardProps) {
  const isImportant = relevanceScore && relevanceScore >= 90;

  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative h-[146px] bg-gradient-to-br from-gray-100 to-gray-200">
        <Link
          href={`/${locale}/post/${id}`}
          className="absolute inset-0 z-10"
          aria-label={`Open article: ${title}`}
        />
        <Image
          src={imageUrl || PLACEHOLDER_IMAGE}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {isImportant && (
          <div className="absolute top-2 right-2 z-20 p-1 bg-lime-100/60 rounded-full">
            <Sparkles className="h-3 w-3 text-lime-500" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pt-[0.225rem] px-3 pb-[0.225rem]">
        {/* Title */}
        <h3 className="text-card-title text-gray-900 line-clamp-2 group-hover:text-ev-green-600 transition-colors">
          <Link href={`/${locale}/post/${id}`}>{title}</Link>
        </h3>

        {/* Source and Date */}
        <div className="flex justify-between items-center">
          {getBrandLogo(category) ? (
            <Image
              src={getBrandLogo(category)!}
              alt={category}
              width={40}
              height={16}
              className="h-4 w-auto object-contain"
            />
          ) : (
            <span className="text-xs text-gray-400">{category}</span>
          )}
          <span className="text-xs text-gray-500 italic">
            {formatRelativeTime(timestamp)}
          </span>
        </div>
      </div>
    </article>
  );
}
