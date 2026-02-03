import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";
import { HeroCard } from "@/components/cards/HeroCard";
import { SideNewsCard } from "@/components/cards/SideNewsCard";
import { MoreNewsSection } from "@/components/sections/MoreNewsSection";
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

  // Time window constants
  const now = Date.now();
  const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const postSelect = {
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
  };

  // Fetch posts from database with error handling
  let featuredPost: Post | null = null;
  let poolPosts: Post[] = [];
  let totalPosts = 0;

  try {
    // Fetch candidates for featured post selection
    const [recentHighQuality, recentBest, weekBest, count] = await Promise.all([
      // Posts from last 48h with score >= 90
      prisma.post.findFirst({
        where: {
          status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
          createdAt: { gte: fortyEightHoursAgo },
          relevanceScore: { gte: 90 },
        },
        orderBy: { relevanceScore: "desc" },
        select: postSelect,
      }),
      // Best from last 48h (any score)
      prisma.post.findFirst({
        where: {
          status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
          createdAt: { gte: fortyEightHoursAgo },
        },
        orderBy: { relevanceScore: "desc" },
        select: postSelect,
      }),
      // Best from last 7 days
      prisma.post.findFirst({
        where: {
          status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { relevanceScore: "desc" },
        select: postSelect,
      }),
      prisma.post.count({
        where: {
          status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
        },
      }),
    ]);

    totalPosts = count;

    // Select featured post using smart selection logic
    // Priority: fresh high-quality (score >= 90 from last 48h)
    featuredPost = recentHighQuality;
    if (!featuredPost) {
      // Fallback: compare 48h best vs 7d best, pick higher score
      if (recentBest && weekBest) {
        featuredPost =
          recentBest.relevanceScore >= weekBest.relevanceScore
            ? recentBest
            : weekBest;
      } else {
        featuredPost = recentBest || weekBest;
      }
    }

    // Fetch pool for other sections (excluding featured), sorted by score
    poolPosts = await prisma.post.findMany({
      where: {
        status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
        createdAt: { gte: sevenDaysAgo },
        ...(featuredPost ? { id: { not: featuredPost.id } } : {}),
      },
      orderBy: { relevanceScore: "desc" },
      take: 20,
      select: postSelect,
    });

    // Fallback to 1 month if not enough posts
    if (poolPosts.length < 10) {
      poolPosts = await prisma.post.findMany({
        where: {
          status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
          createdAt: { gte: oneMonthAgo },
          ...(featuredPost ? { id: { not: featuredPost.id } } : {}),
        },
        orderBy: { relevanceScore: "desc" },
        take: 20,
        select: postSelect,
      });
    }
  } catch {
    // Database unavailable - show empty state
    console.error("Failed to fetch posts from database");
  }

  // Split posts for layout:
  // Featured: Smart selection (center)
  // Posts 0-1: Left column cards
  // Posts 2-9: Top Headlines (8 items)
  // Posts 10+: More News section
  const leftColumnPosts = poolPosts.slice(0, 2);
  const topHeadlines = poolPosts.slice(2, 10);
  const moreNews = poolPosts.slice(10);

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
      {featuredPost || poolPosts.length > 0 ? (
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
            <MoreNewsSection
              initialPosts={moreNews.map((post) => ({
                id: post.id,
                title: getTitle(post) || "Untitled",
                summary: getSummary(post) || "",
                category: post.categories[0] || "News",
                source: post.sourceAuthor,
                sourceUrl: post.sourceUrl,
                timestamp: post.sourceDate,
                imageUrl: getImage(post),
                relevanceScore: post.relevanceScore,
              }))}
              locale={locale}
              sectionTitle={locale === "zh" ? "更多新闻" : "More News"}
              totalInitialPosts={poolPosts.length + (featuredPost ? 1 : 0)}
              initialHasMore={totalPosts > 20}
            />
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
