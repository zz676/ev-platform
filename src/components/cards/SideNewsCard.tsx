import Image from "next/image";
import Link from "next/link";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";

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
      <div className="relative h-[120px] bg-gradient-to-br from-gray-100 to-gray-200">
        <Image
          src={imageUrl || PLACEHOLDER_IMAGE}
          alt={title}
          fill
          className="object-cover"
          sizes="(min-width: 1280px) 250px, 200px"
        />
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-ev-green-600 transition-colors mb-2">
          {title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-gray-500 line-clamp-3">{summary}</p>
      </div>
    </Link>
  );
}
