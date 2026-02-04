"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Sparkles,
  Calendar,
  Clock,
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

  // Share to Reddit
  const shareToReddit = () => {
    const postTitle = encodeURIComponent(title || "Check out this article");
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.reddit.com/submit?url=${url}&title=${postTitle}`,
      "_blank"
    );
  };

  // Share to LinkedIn
  const shareToLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      "_blank"
    );
  };

  // Share to Facebook
  const shareToFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
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
    <div className="max-w-7xl mx-auto px-3 py-[0.6rem]">
      <div className="flex flex-col lg:flex-row gap-[1.275rem]">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Article card */}
          <article className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Metadata bar */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border-b border-gray-200 text-sm">
              <CategoryBadge category={category} variant="green" />
              {isImportant && (
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div className="flex items-center gap-1.5 text-ev-green-600 ml-auto">
                <Clock className="h-4 w-4" />
                <span className="italic">{readingTime} min read</span>
              </div>
            </div>

            {/* Header */}
            <div className="px-3 pt-[0.554rem] pb-[0.318rem] border-b border-gray-100">
              <h1 className="text-[1.161rem] md:text-[1.453rem] font-bold text-gray-600 text-center max-w-[70%] mx-auto">
                {title || "Untitled"}
              </h1>
              <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mt-2">
                <Calendar className="h-4 w-4" />
                <span className="italic">{formatDate(sourceDate)}</span>
              </div>
            </div>

            {/* Content */}
            <div className="px-[1.35rem] pt-[0.6rem]">
              <div className="prose prose-gray max-w-none">
                {content.split("\n").map((paragraph, idx) => (
                  <React.Fragment key={idx}>
                    <p className="mb-4 text-gray-600 leading-relaxed">
                      {paragraph}
                    </p>
                    {/* Insert first image after first paragraph */}
                    {idx === 0 && imageUrls.length > 0 && (
                      <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-lg my-6">
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
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto">
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

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-gray-50 border-t border-gray-200">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ev-green-600 hover:text-ev-green-700 transition-colors"
                title={translations.readOriginal}
              >
                <ExternalLink className="h-5 w-5" />
              </a>
              <div className="flex items-center gap-4">
                <button
                  onClick={copyLink}
                  className="text-ev-green-600 hover:text-ev-green-700 transition-colors"
                  title="Copy link"
                >
                  {linkCopied ? (
                    <Check className="h-[1.375rem] w-[1.375rem] text-ev-green-600" />
                  ) : (
                    <Link2 className="h-[1.375rem] w-[1.375rem]" />
                  )}
                </button>
                <button
                  onClick={shareToX}
                  className="text-ev-green-600 hover:text-ev-green-700 transition-colors"
                  title="Share on X"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                {/* Share to Reddit */}
                <button
                  onClick={shareToReddit}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-orange-500 transition-colors"
                  aria-label="Share to Reddit"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </button>
                {/* Share to LinkedIn */}
                <button
                  onClick={shareToLinkedIn}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-[#0A66C2] transition-colors"
                  aria-label="Share to LinkedIn"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </button>
                {/* Share to Facebook */}
                <button
                  onClick={shareToFacebook}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-[#1877F2] transition-colors"
                  aria-label="Share to Facebook"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
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
