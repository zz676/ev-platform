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
    <div className="bg-white rounded-xl border border-lime-300 py-4 px-[0.72rem]">
      <h3 className="font-semibold text-gray-600 mb-4">{title}</h3>
      <div className="divide-y divide-lime-200">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/${locale}/post/${article.id}`}
            className={`block group ${index > 0 ? 'pt-[0.85rem]' : ''} ${index < articles.length - 1 ? 'pb-[0.85rem]' : ''}`}
          >
            <p className="text-sm text-gray-600 line-clamp-2 group-hover:text-ev-green-600 transition-colors leading-snug">
              {article.title}
            </p>
            <p className="text-xs text-gray-500 italic text-left mt-1">
              {formatRelativeTime(article.timestamp)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
