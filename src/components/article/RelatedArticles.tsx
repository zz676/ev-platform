import Link from "next/link";

interface RelatedArticle {
  id: string;
  title: string;
  category: string;
  timestamp: Date;
}

interface RelatedArticlesProps {
  articles: RelatedArticle[];
  locale: string;
  title?: string;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function RelatedArticles({
  articles,
  locale,
  title = "Related News",
}: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="bg-lime-50/40 border border-lime-100 rounded-lg pt-[0.56rem] pb-3 px-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ev-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-ev-green-500"></span>
        </span>
        {title}
      </h2>
      <ol className="space-y-0">
        {articles.map((article, index) => {
          const isTop3 = index < 3;
          return (
            <li key={article.id}>
              <Link
                href={`/${locale}/post/${article.id}`}
                className="flex items-start gap-2.5 py-[0.3rem] px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className={`flex-shrink-0 w-5 text-center font-bold text-sidebar leading-tight mt-[0.1rem] ${
                  isTop3 ? "text-ev-green-600" : "text-gray-400"
                }`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sidebar text-gray-900 line-clamp-2 group-hover:text-ev-green-600 transition-colors leading-tight ${
                    isTop3 ? "font-semibold" : "font-medium"
                  }`}>
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-400 italic mt-0.5">
                    {formatRelativeTime(article.timestamp)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
