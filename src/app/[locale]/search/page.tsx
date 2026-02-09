import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { PostStatus, Prisma } from "@prisma/client";
import { NewsCard } from "@/components/cards/NewsCard";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export const dynamic = "force-dynamic";

type Post = {
  id: string;
  sourceDate: Date;
  originalTitle: string | null;
  translatedTitle: string | null;
  cardImageUrl: string | null;
  categories: string[];
  relevanceScore: number;
  createdAt: Date;
};

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q: query } = await searchParams;
  const t = await getTranslations("Search");

  let posts: Post[] = [];
  const searchTerm = query?.trim() || "";

  if (searchTerm.length > 0) {
    try {
      const searchConditions: Prisma.PostWhereInput[] = [
        { translatedTitle: { contains: searchTerm, mode: "insensitive" } },
        { translatedContent: { contains: searchTerm, mode: "insensitive" } },
        { originalTitle: { contains: searchTerm, mode: "insensitive" } },
        { originalContent: { contains: searchTerm, mode: "insensitive" } },
      ];

      posts = await prisma.post.findMany({
        where: {
          AND: [
            { status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] } },
            { OR: searchConditions },
          ],
        },
        orderBy: [{ relevanceScore: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          sourceDate: true,
          originalTitle: true,
          translatedTitle: true,
          cardImageUrl: true,
          categories: true,
          relevanceScore: true,
          createdAt: true,
        },
      });
    } catch {
      console.error("Failed to search posts from database");
    }
  }

  // Helper to get localized title
  const getTitle = (post: Post) =>
    locale === "zh"
      ? post.originalTitle || post.translatedTitle
      : post.translatedTitle || post.originalTitle;

  // Helper to get image for cards (uses cardImageUrl, falls back to placeholder)
  const getImage = (post: Post) => post.cardImageUrl || undefined;

  return (
    <div className="px-6 pt-3 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ev-green-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToHome")}
      </Link>

      {/* Search header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Search className="h-6 w-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">
            {searchTerm ? t("resultsFor", { query: searchTerm }) : t("title")}
          </h1>
        </div>
        {searchTerm && (
          <p className="text-gray-500">
            {t("foundCount", { count: posts.length })}
          </p>
        )}
      </div>

      {/* Results */}
      {posts.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <NewsCard
              key={post.id}
              id={post.id}
              title={getTitle(post) || "Untitled"}
              category={post.categories[0] || "News"}
              timestamp={post.sourceDate}
              imageUrl={getImage(post)}
              relevanceScore={post.relevanceScore}
              locale={locale}
            />
          ))}
        </div>
      ) : searchTerm ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-2">{t("noResults")}</p>
          <p className="text-sm text-gray-400">{t("tryDifferent")}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">{t("enterQuery")}</p>
        </div>
      )}
    </div>
  );
}
