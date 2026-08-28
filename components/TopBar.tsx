"use client";

import { useMemo } from "react";
import { Search, Bell, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAnalysis } from "@/lib/hooks/useApiData";

/**
 * Shared top bar for every page.
 *  LEFT   = current date + an honest market/sentiment indicator chip.
 *  CENTER = search input.
 *  RIGHT  = notification bell + user avatar/name.
 *
 * There is no guaranteed markets API key, so the indicator is driven from the
 * overall economic sentiment returned by /api/analysis. It is labelled as a
 * SENTIMENT signal, not presented as a fabricated live index quote.
 */
export function TopBar() {
  const { data } = useAnalysis();
  const sentiment = data?.summary?.overallSentiment ?? "neutral";

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "short",
      }),
    []
  );

  const indicator = {
    bullish: {
      label: "Markets",
      value: "Bullish",
      Icon: TrendingUp,
      cls: "text-emerald border-emerald/30 bg-emerald/10",
      dot: "bg-emerald",
    },
    bearish: {
      label: "Markets",
      value: "Bearish",
      Icon: TrendingDown,
      cls: "text-red-400 border-red-400/30 bg-red-400/10",
      dot: "bg-red-400",
    },
    neutral: {
      label: "Markets",
      value: "Neutral",
      Icon: Minus,
      cls: "text-gray-300 border-gray-500/30 bg-gray-500/10",
      dot: "bg-gray-400",
    },
  }[sentiment];

  const { Icon } = indicator;

  return (
    <header className="shrink-0 border-b border-[#2a2a2a] bg-[#0d0d0d]/80 backdrop-blur-xl px-5 lg:px-8 py-3.5">
      <div className="flex items-center gap-4">
        {/* LEFT: date + market indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white leading-none">{today}</p>
            <p className="text-[11px] text-muted mt-1">Economic Intelligence</p>
          </div>
          <span
            title="Overall economic sentiment derived from today's analysis (not a live index quote)"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${indicator.cls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{indicator.label}</span>
            <span className="font-semibold">{indicator.value}</span>
          </span>
        </div>

        {/* CENTER: search */}
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search here..."
              aria-label="Search"
              className="w-full rounded-full bg-[#161616] border border-[#242424] pl-10 pr-4 py-2 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:border-lime/40 transition-colors"
            />
          </div>
        </div>

        {/* RIGHT: notifications + avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex items-center justify-center h-9 w-9 rounded-full border border-[#242424] bg-[#161616] text-gray-400 hover:text-gray-200 hover:border-[#3a3a3a] transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-lime" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-lime to-emerald text-black text-xs font-bold">
              QF
            </div>
            <div className="hidden md:block leading-tight">
              <p className="text-sm font-medium text-white">Analyst</p>
              <p className="text-[11px] text-muted">QuantFeed</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
