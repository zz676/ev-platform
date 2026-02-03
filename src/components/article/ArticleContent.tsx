"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Sparkles,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { LanguageToggle } from "./LanguageToggle";
import { RelatedArticles } from "./RelatedArticles";
import { cn } from "@/lib/utils";

interface ArticleContentProps {
  id: string;
  originalTitle: string | null;
  translatedTitle: string | null;
  originalContent: string;
  translatedContent: string;
  category: string;
  source: string;
  sourceUrl: string;
  sourceDate: Date;
  relevanceScore: number;
  imageUrls: string[];
  locale: string;
  relatedArticles: {
    id: string;
    title: string;
    category: string;
    timestamp: Date;
  }[];
  translations: {
    backToFeed: string;
    id: string;
    source: string;
    published: string;
    impact: string;
    highImpact: string;
    mediumImpact: string;
    lowImpact: string;
    readOriginal: string;
    share: string;
    relatedArticles: string;
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImportantArticle(score: number): boolean {
  return score >= 90;
}

export function ArticleContent({
  id,
  originalTitle,
  translatedTitle,
  originalContent,
  translatedContent,
  category,
  source,
  sourceUrl,
  sourceDate,
  relevanceScore,
  imageUrls,
  locale,
  relatedArticles,
  translations,
}: ArticleContentProps) {
  const [contentLanguage, setContentLanguage] = useState<"en" | "zh">(
    locale === "zh" ? "zh" : "en"
  );

  const handleLanguageChange = useCallback((lang: "en" | "zh") => {
    setContentLanguage(lang);
  }, []);

  const title = contentLanguage === "zh" ? originalTitle : translatedTitle;
  const content = contentLanguage === "zh" ? originalContent : translatedContent;
  const isImportant = isImportantArticle(relevanceScore);

  return (
    <div className="flex gap-6 p-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Back button */}
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {translations.backToFeed}
        </Link>

        {/* Article card */}
        <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Hash className="h-4 w-4" />
              <span>{translations.id}:</span>
              <span className="font-mono text-gray-700">{id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <User className="h-4 w-4" />
              <span>{translations.source}:</span>
              <span className="text-gray-700">{source}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>{translations.published}:</span>
              <span className="text-gray-700">{formatDate(sourceDate)}</span>
            </div>
            {isImportant && (
              <div className="flex items-center gap-1.5 text-amber-500">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Header */}
          <div className="px-6 py-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <CategoryBadge category={category} />
              <LanguageToggle
                onLanguageChange={handleLanguageChange}
                defaultLanguage={locale === "zh" ? "zh" : "en"}
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {title || "Untitled"}
            </h1>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="prose prose-gray max-w-none">
              {content.split("\n").map((paragraph, idx) => (
                <p key={idx} className="mb-4 text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Images */}
          {imageUrls.length > 0 && (
            <div className="px-6 pb-6">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {imageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-lg overflow-hidden bg-gray-100"
                  >
                    <Image
                      src={url}
                      alt={`Article image ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ev-green-700 bg-ev-green-50 rounded-lg hover:bg-ev-green-100 transition-colors"
            >
              {translations.readOriginal}
              <ExternalLink className="h-4 w-4" />
            </a>
            <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Share2 className="h-4 w-4" />
              {translations.share}
            </button>
          </div>
        </article>
      </div>

      {/* Right sidebar - Related Articles */}
      <div className="hidden lg:block w-72 flex-shrink-0">
        <RelatedArticles
          articles={relatedArticles}
          locale={locale}
          title={translations.relatedArticles}
        />
      </div>
    </div>
  );
}
