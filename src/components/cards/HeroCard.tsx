import Image from "next/image";
import Link from "next/link";
import { PLACEHOLDER_IMAGE, HERO_BLUR_DATA_URL } from "@/lib/constants";

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
        isLarge ? "h-[468px]" : "h-[120px]"
      }`}
    >
      {/* Background with gradient fill for letterboxing */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900">
        <Image
          src={imageUrl || PLACEHOLDER_IMAGE}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes={isLarge ? "(max-width: 768px) 100vw, 50vw" : "25vw"}
          priority={isLarge}
          placeholder="blur"
          blurDataURL={HERO_BLUR_DATA_URL}
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
        {/* Title */}
        <h2
          className={`font-bold text-white leading-tight group-hover:text-ev-green-300 transition-colors ${
            isLarge
              ? "text-hero-sm md:text-hero-lg line-clamp-3"
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
          {getBrandLogo(category) ? (
            <Image
              src={getBrandLogo(category)!}
              alt={category}
              width={40}
              height={16}
              className="h-4 w-auto object-contain brightness-0 invert opacity-70"
            />
          ) : (
            <span className="font-medium">{category}</span>
          )}
          <span>·</span>
          <span className="italic">{formatRelativeTime(timestamp)}</span>
        </div>
      </div>
    </Link>
  );
}
