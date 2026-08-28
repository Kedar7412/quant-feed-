"use client";

import { useState } from "react";
import { format, differenceInHours } from "date-fns";
import { ExternalLink, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NewsArticle } from "@/lib/types";

interface NewsCardProps {
  article: NewsArticle;
}

const categoryBorderColors: Record<string, string> = {
  domestic: "border-l-green-500",
  international: "border-l-blue-500",
  economic: "border-l-amber-500",
  political: "border-l-red-500",
};

const categoryGradients: Record<string, string> = {
  domestic: "from-green-500 to-emerald-600",
  international: "from-blue-500 to-sky-600",
  economic: "from-amber-500 to-orange-600",
  political: "from-red-500 to-rose-600",
};

const categoryTagBg: Record<string, string> = {
  domestic: "bg-green-500/10 text-green-400 border-green-500/20",
  international: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  economic: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  political: "bg-red-500/10 text-red-400 border-red-500/20",
};

function FreshnessDot({ publishedAt }: { publishedAt: string }) {
  const hoursAgo = differenceInHours(new Date(), new Date(publishedAt));

  let color = "bg-gray-500";
  let shadow = "";
  let label = "Older";

  if (hoursAgo < 24) {
    color = "bg-green-400";
    shadow = "shadow-[0_0_6px_rgba(34,197,94,0.5)]";
    label = "Today";
  } else if (hoursAgo < 48) {
    color = "bg-amber-400";
    shadow = "shadow-[0_0_4px_rgba(245,158,11,0.4)]";
    label = "Recent";
  }

  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${shadow}`}
      title={label}
    />
  );
}

export function NewsCard({ article }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.002 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`card-premium p-4 border-l-[3px] ${
        categoryBorderColors[article.category] || "border-l-lime"
      } hover:border-l-lime transition-all duration-300 card-hover-glow`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                categoryTagBg[article.category] || "bg-lime/10 text-lime border-lime/20"
              }`}
            >
              {article.category}
            </span>
            <span className="text-[10px] text-gray-500">{article.subcategory}</span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2 leading-snug">
            {article.title}
          </h3>
          <AnimatePresence mode="wait">
            {expanded ? (
              <motion.p
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="text-xs text-gray-400 mb-3 leading-relaxed"
              >
                {article.summary}
              </motion.p>
            ) : (
              <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                {article.summary}
              </p>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="font-medium text-gray-400">{article.source}</span>
            <div className="flex items-center gap-1.5">
              <FreshnessDot publishedAt={article.publishedAt} />
              <span>{format(new Date(article.publishedAt), "MMM dd, yyyy")}</span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 text-lime hover:text-lime-soft transition-colors"
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
          <div className="flex items-center gap-1 bg-lime/10 border border-lime/20 px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3 text-lime" />
            <span className="text-xs font-medium text-lime">
              {article.economicImpactScore}/10
            </span>
          </div>
          {article.relevanceScore !== undefined && (
            <span className="text-[10px] text-gray-500 font-medium">
              {Math.round(article.relevanceScore * 100)}% rel
            </span>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-lime transition-colors p-1 rounded-md hover:bg-white/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/[0.04]">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-white/[0.04] text-gray-400 rounded-md border border-white/[0.06] hover:border-white/10 transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
