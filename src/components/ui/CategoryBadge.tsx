"use client";

import { cn } from "@/lib/utils";

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

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const normalizedCategory = category.toUpperCase() as CategoryType;
  const styles = categoryStyles[normalizedCategory] || categoryStyles.default;

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
