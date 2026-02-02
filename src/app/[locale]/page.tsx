import { getTranslations } from "next-intl/server";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { PostStatus } from "@prisma/client";

// Render at request time, not build time (database not available during build)
export const dynamic = "force-dynamic";

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Home");

  // Fetch posts from database
  const posts = await prisma.post.findMany({
    where: {
      status: { in: [PostStatus.APPROVED, PostStatus.PUBLISHED] },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
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
      categories: true,
      createdAt: true,
    },
  });

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
            </div>
            <nav className="flex items-center gap-6">
              <Link href="/en" className="hover:opacity-80">EN</Link>
              <Link href="/zh" className="hover:opacity-80">中文</Link>
              <Link
                href="/subscribe"
                className="bg-white text-purple-600 px-4 py-2 rounded-full font-medium hover:bg-opacity-90"
              >
                {t("subscribe")}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-purple-600 to-purple-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t("hero.title")}
          </h2>
          <p className="text-xl text-purple-100 max-w-2xl mx-auto mb-8">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">BYD</span>
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">NIO</span>
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">XPeng</span>
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">Li Auto</span>
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">Xiaomi</span>
            <span className="bg-white/20 px-4 py-2 rounded-full text-sm">Zeekr</span>
          </div>
        </div>
      </section>

      {/* News Feed Placeholder */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold text-gray-800 mb-8">{t("latestNews")}</h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.length > 0 ? (
              posts.map((post) => {
                const title = locale === "zh" ? post.originalTitle : post.translatedTitle;
                const summary = post.translatedSummary || (locale === "zh" ? post.originalContent : post.translatedContent);
                const category = post.categories[0] || "News";

                return (
                  <article
                    key={post.id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm font-medium">
                        {category}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {formatRelativeTime(post.sourceDate)}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      {title || "Untitled"}
                    </h4>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {summary?.slice(0, 150)}...
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Source: {post.sourceAuthor}</span>
                      <Link href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                        {t("readMore")} →
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="col-span-3 text-center text-gray-500 py-8">
                No news available yet. Check back soon!
              </div>
            )}
          </div>

          <div className="text-center mt-8">
            <button className="bg-purple-600 text-white px-8 py-3 rounded-full font-medium hover:bg-purple-700 transition-colors">
              {t("loadMore")}
            </button>
          </div>
        </div>
      </section>

      {/* Subscribe CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-gray-800 mb-4">
            {t("cta.title")}
          </h3>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            {t("cta.description")}
          </p>
          <form className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder={t("cta.emailPlaceholder")}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              {t("subscribe")}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <span className="text-2xl">⚡</span>
              <span className="font-bold">China EV News</span>
            </div>
            <div className="flex gap-6 text-gray-400">
              <Link href="/about" className="hover:text-white">About</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                X
              </a>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-8">
            © 2025 China EV News. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
