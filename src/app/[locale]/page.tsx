import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { NewsCard } from "@/components/cards/NewsCard";
import { HeroCard } from "@/components/cards/HeroCard";
import { SideNewsCard } from "@/components/cards/SideNewsCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Post = {
  id: string;
  source: string;
  sourceUrl: string;
  sourceAuthor: string;
  sourceDate: Date;
  originalTitle: string | null;
  translatedTitle: string | null;
  originalContent: string | null;
  translatedContent: string | null;
  translatedSummary: string | null;
  originalMediaUrls: string[];
  categories: string[];
  relevanceScore: number;
  createdAt: Date;
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Feed");

  // Fetch posts from database with error handling
  let posts: Post[] = [];
  try {
    posts = await prisma.post.findMany({
      where: {
        status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
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
        translatedSummary: true,
        originalMediaUrls: true,
        categories: true,
        relevanceScore: true,
        createdAt: true,
      },
    });
  } catch {
    // Database unavailable - show empty state
    console.error("Failed to fetch posts from database");
  }

  // Split posts for USAToday-style layout:
  // Posts 0-1: Left column news cards (2 cards)
  // Post 2: Center featured article
  // Posts 3-8: Right column headlines (6 items)
  // Posts 9+: More News section below
  const leftColumnPosts = posts.slice(0, 2);
  const featuredPost = posts[2];
  const topHeadlines = posts.slice(3, 9);
  const moreNews = posts.slice(9);

  // Helper to get localized title
  const getTitle = (post: Post) =>
    locale === "zh"
      ? post.originalTitle || post.translatedTitle
      : post.translatedTitle || post.originalTitle;

  // Helper to get summary
  const getSummary = (post: Post) =>
    post.translatedSummary ||
    (locale === "zh"
      ? post.originalContent?.slice(0, 150)
      : post.translatedContent?.slice(0, 150));

  // Helper to get image
  const getImage = (post: Post) =>
    post.originalMediaUrls && post.originalMediaUrls.length > 0
      ? post.originalMediaUrls[0]
      : undefined;

  // Helper to format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Main Content */}
      {posts.length > 0 ? (
        <div className="space-y-4">
          {/* Featured Section - USAToday Style 3-Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[250px_1fr_280px] gap-6">
            {/* Left Column - 2 News Cards (stacked) */}
            <div className="flex flex-col justify-between gap-4 order-2 md:order-1 lg:order-1 h-[500px]">
              {leftColumnPosts.map((post) => (
                <SideNewsCard
                  key={post.id}
                  id={post.id}
                  title={getTitle(post) || "Untitled"}
                  summary={getSummary(post) || ""}
                  category={post.categories[0] || "News"}
                  source={post.sourceAuthor}
                  timestamp={post.sourceDate.toISOString()}
                  imageUrl={getImage(post)}
                  locale={locale}
                />
              ))}
            </div>

            {/* Center Column - Featured Card */}
            <div className="order-1 md:col-span-2 lg:col-span-1 lg:order-2">
              {featuredPost && (
                <HeroCard
                  id={featuredPost.id}
                  title={getTitle(featuredPost) || "Untitled"}
                  category={featuredPost.categories[0] || "News"}
                  source={featuredPost.sourceAuthor}
                  timestamp={featuredPost.sourceDate.toISOString()}
                  imageUrl={getImage(featuredPost)}
                  locale={locale}
                  size="large"
                />
              )}
            </div>

            {/* Right Column - Top Headlines (with vertical divider) */}
            <div className="order-3 border-l-0 lg:border-l lg:border-ev-green-200 lg:pl-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {locale === "zh" ? "热门新闻" : "Top Headlines"}
              </h2>
              <ul className="space-y-3">
                {topHeadlines.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/${locale}/post/${post.id}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-ev-green-500 font-bold text-sm mt-0.5">
                          •
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-ev-green-600 transition-colors leading-snug">
                            {getTitle(post) || "Untitled"}
                          </h3>
                          <span className="text-xs text-gray-400 mt-1 block">
                            {formatRelativeTime(post.sourceDate)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* More News Section */}
          {moreNews.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {locale === "zh" ? "更多新闻" : "More News"}
                </h2>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {moreNews.map((post) => (
                  <NewsCard
                    key={post.id}
                    id={post.id}
                    title={getTitle(post) || "Untitled"}
                    summary={getSummary(post) || ""}
                    category={post.categories[0] || "News"}
                    source={post.sourceAuthor}
                    sourceUrl={post.sourceUrl}
                    timestamp={post.sourceDate}
                    imageUrl={getImage(post)}
                    relevanceScore={post.relevanceScore}
                    locale={locale}
                  />
                ))}
              </div>
              {/* More Button */}
              <div className="mt-6 flex justify-center">
                <button className="relative px-6 py-2 text-xs font-semibold tracking-wider text-gray-600 rounded-full border-2 border-lime-400 hover:border-lime-500 hover:text-gray-800 transition-all duration-300 hover:shadow-[0_0_12px_rgba(163,230,53,0.5)] before:absolute before:inset-0 before:rounded-full before:border-2 before:border-lime-400 before:animate-pulse before:opacity-40">
                  MORE
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          </div>
          <p className="text-gray-500">{t("noResults")}</p>
        </div>
      )}
    </div>
  );
}
