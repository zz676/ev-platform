"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Sparkles,
  Calendar,
  Clock,
  Twitter,
  Link2,
  Check,
} from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { RelatedArticles } from "./RelatedArticles";

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
  originalTitle,
  translatedTitle,
  originalContent,
  translatedContent,
  category,
  sourceUrl,
  sourceDate,
  relevanceScore,
  imageUrls,
  locale,
  relatedArticles,
  translations,
}: ArticleContentProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  // Use locale prop directly (global header toggle handles language)
  const title = locale === "zh" ? originalTitle : translatedTitle;
  const content = locale === "zh" ? originalContent : translatedContent;
  const isImportant = isImportantArticle(relevanceScore);

  // Calculate reading time (avg 200 words/min)
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Share to X/Twitter
  const shareToX = () => {
    const text = encodeURIComponent(title || "Check out this article");
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  // Copy link to clipboard
  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Article card */}
          <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Metadata bar - simplified with only reading time right-aligned */}
            <div className="flex items-center justify-end gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm">
              {isImportant && (
                <div className="flex items-center gap-1.5 text-amber-500 mr-auto">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-500">
                <Clock className="h-4 w-4" />
                <span>{readingTime} min read</span>
              </div>
            </div>

            {/* Header */}
            <div className="px-6 py-6 border-b border-gray-100">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {title || "Untitled"}
              </h1>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="prose prose-gray max-w-none">
                {content.split("\n").map((paragraph, idx) => (
                  <React.Fragment key={idx}>
                    <p className="mb-4 text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                    {/* Insert first image after first paragraph */}
                    {idx === 0 && imageUrls.length > 0 && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg my-6">
                        <Image
                          src={imageUrls[0]}
                          alt={title || "Article image"}
                          fill
                          className="object-cover"
                          priority
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Additional Images (if more than one) */}
            {imageUrls.length > 1 && (
              <div className="px-6 pb-6">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {imageUrls.slice(1).map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-video rounded-lg overflow-hidden bg-gray-100"
                    >
                      <Image
                        src={url}
                        alt={`Article image ${idx + 2}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Published date + Category badge */}
            <div className="flex items-center justify-between px-6 pb-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>{translations.published}:</span>
                <span className="text-gray-700">{formatDate(sourceDate)}</span>
              </div>
              <CategoryBadge category={category} />
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ev-green-700 bg-ev-green-50 rounded-lg hover:bg-ev-green-100 transition-colors"
              >
                {translations.readOriginal}
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="flex items-center gap-2">
                <button
                  onClick={shareToX}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Share on X"
                >
                  <Twitter className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copy link"
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {linkCopied ? "Copied!" : "Copy Link"}
                  </span>
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Right sidebar - Related Articles (now visible on mobile too) */}
        <div className="w-full lg:w-72 flex-shrink-0 mt-6 lg:mt-0">
          <RelatedArticles
            articles={relatedArticles}
            locale={locale}
            title={translations.relatedArticles}
          />
        </div>
      </div>
    </div>
  );
}
