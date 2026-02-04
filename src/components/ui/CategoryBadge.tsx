"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

type CategoryType =
  | "BREAKING"
  | "EU MARKET"
  | "CHINA MARKET"
  | "TECH"
  | "INFRASTRUCTURE"
  | "REGULATORY"
  | "BULLISH"
  | "BEARISH"
  | "ANALYSIS"
  | "POLICY"
  | "default";

const categoryStyles: Record<CategoryType, string> = {
  BREAKING: "bg-red-100 text-red-700 border-red-200",
  "EU MARKET": "bg-blue-100 text-blue-700 border-blue-200",
  "CHINA MARKET": "bg-amber-100 text-amber-700 border-amber-200",
  TECH: "bg-purple-100 text-purple-700 border-purple-200",
  INFRASTRUCTURE: "bg-slate-100 text-slate-700 border-slate-200",
  REGULATORY: "bg-orange-100 text-orange-700 border-orange-200",
  BULLISH: "bg-ev-green-100 text-ev-green-700 border-ev-green-200",
  BEARISH: "bg-red-100 text-red-700 border-red-200",
  ANALYSIS: "bg-indigo-100 text-indigo-700 border-indigo-200",
  POLICY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  default: "bg-gray-100 text-gray-700 border-gray-200",
};

// Brand logos mapping
const brandLogos: Record<string, string> = {
  NIO: "/images/brands/nio.svg",
  XPENG: "/images/brands/xpeng.svg",
  "LI AUTO": "/images/brands/li-auto.svg",
  BYD: "/images/brands/byd.svg",
  TESLA: "/images/brands/tesla.svg",
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
  variant?: "default" | "green";
}

export function CategoryBadge({ category, className, variant = "default" }: CategoryBadgeProps) {
  const normalizedCategory = category.toUpperCase() as CategoryType;
  const styles = categoryStyles[normalizedCategory] || categoryStyles.default;
  const logoPath = brandLogos[normalizedCategory];

  // If it's a brand with a logo, show the logo
  if (logoPath) {
    return (
      <div className={cn("inline-flex items-center", className)}>
        <Image
          src={logoPath}
          alt={category}
          width={60}
          height={24}
          className={cn(
            "h-6 w-auto object-contain",
            variant === "green" && "brightness-0 saturate-100 invert-[.4] sepia-[.9] saturate-[5] hue-rotate-[85deg]"
          )}
        />
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        styles,
        className
      )}
    >
      {category.toUpperCase()}
    </span>
  );
}
