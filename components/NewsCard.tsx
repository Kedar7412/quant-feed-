"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NewsArticle } from "@/lib/types";

interface NewsCardProps {
  article: NewsArticle;
}

const categoryGradients: Record<string, string> = {
  domestic: "from-green-500 to-emerald-600",
  international: "from-blue-500 to-indigo-600",
  economic: "from-amber-500 to-orange-600",
  political: "from-red-500 to-rose-600",
};

export function NewsCard({ article }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="glass rounded-xl p-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${
                categoryGradients[article.category]
              } text-white font-medium`}
            >
              {article.category}
            </span>
            <span className="text-xs text-gray-500">{article.subcategory}</span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">
            {article.title}
          </h3>
          <AnimatePresence>
            {expanded ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-gray-400 mb-3"
              >
                {article.summary}
              </motion.p>
            ) : (
              <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                {article.summary}
              </p>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{article.source}</span>
            <span>{format(new Date(article.publishedAt), "MMM dd, yyyy")}</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span>Less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span>More</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 glass px-2 py-1 rounded-lg">
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
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/5">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-white/5 text-gray-400 rounded border border-white/5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
