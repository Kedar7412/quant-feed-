"use client";

import { format } from "date-fns";
import { ExternalLink, TrendingUp } from "lucide-react";
import { NewsArticle } from "@/lib/types";

interface NewsCardProps {
  article: NewsArticle;
}

const categoryColors: Record<string, string> = {
  domestic: "bg-green-400/10 text-green-400 border-green-400/20",
  international: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  economic: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  political: "bg-red-400/10 text-red-400 border-red-400/20",
};

export function NewsCard({ article }: NewsCardProps) {
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                categoryColors[article.category]
              }`}
            >
              {article.category}
            </span>
            <span className="text-xs text-gray-500">{article.subcategory}</span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
            {article.title}
          </h3>
          <p className="text-xs text-gray-400 line-clamp-2 mb-3">
            {article.summary}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{article.source}</span>
            <span>{format(new Date(article.publishedAt), "MMM dd, yyyy")}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-400">
              {article.economicImpactScore}/10
            </span>
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-indigo-400 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-700/50">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-gray-700/50 text-gray-400 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
