import Link from "next/link";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

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
  title = "Related Articles",
}: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/${locale}/post/${article.id}`}
            className="block group"
          >
            <div className="flex items-start gap-2 mb-1">
              <CategoryBadge category={article.category} className="text-[10px] px-1.5" />
              <span className="text-xs text-gray-500">
                {formatRelativeTime(article.timestamp)}
              </span>
            </div>
            <p className="text-sm text-gray-700 line-clamp-2 group-hover:text-ev-green-600 transition-colors">
              {article.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
