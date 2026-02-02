import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { ArticleContent } from "@/components/article/ArticleContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("Article");

  // Fetch the post with error handling
  let post;
  try {
    post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        sourceUrl: true,
        sourceAuthor: true,
        sourceDate: true,
        originalTitle: true,
        translatedTitle: true,
        originalContent: true,
        translatedContent: true,
        originalMediaUrls: true,
        categories: true,
        relevanceScore: true,
        status: true,
      },
    });
  } catch {
    // Database unavailable
    console.error("Failed to fetch post from database");
    notFound();
  }

  if (
    !post ||
    (post.status !== PostStatus.APPROVED && post.status !== PostStatus.PUBLISHED)
  ) {
    notFound();
  }

  // Fetch related articles (same category or source)
  let relatedPosts: {
    id: string;
    originalTitle: string | null;
    translatedTitle: string | null;
    categories: string[];
    sourceDate: Date;
  }[] = [];

  try {
    relatedPosts = await prisma.post.findMany({
      where: {
        id: { not: post.id },
        status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
        OR: [
          { categories: { hasSome: post.categories } },
          { source: post.source },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        originalTitle: true,
        translatedTitle: true,
        categories: true,
        sourceDate: true,
      },
    });
  } catch {
    // Database error for related posts - continue without them
    console.error("Failed to fetch related posts");
  }

  const relatedArticles = relatedPosts.map((p) => ({
    id: p.id,
    title:
      locale === "zh"
        ? p.originalTitle || p.translatedTitle || "Untitled"
        : p.translatedTitle || p.originalTitle || "Untitled",
    category: p.categories[0] || "News",
    timestamp: p.sourceDate,
  }));

  const translations = {
    backToFeed: t("backToFeed"),
    id: t("id"),
    source: t("source"),
    published: t("published"),
    impact: t("impact"),
    highImpact: t("highImpact"),
    mediumImpact: t("mediumImpact"),
    lowImpact: t("lowImpact"),
    readOriginal: t("readOriginal"),
    share: t("share"),
    relatedArticles: t("relatedArticles"),
  };

  return (
    <ArticleContent
      id={post.id}
      originalTitle={post.originalTitle}
      translatedTitle={post.translatedTitle}
      originalContent={post.originalContent || ""}
      translatedContent={post.translatedContent || ""}
      category={post.categories[0] || "News"}
      source={post.sourceAuthor}
      sourceUrl={post.sourceUrl}
      sourceDate={post.sourceDate}
      relevanceScore={post.relevanceScore}
      imageUrls={post.originalMediaUrls}
      locale={locale}
      relatedArticles={relatedArticles}
      translations={translations}
    />
  );
}
