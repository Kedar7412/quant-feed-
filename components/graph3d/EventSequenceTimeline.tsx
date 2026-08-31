"use client";

/**
 * Event-sequence timeline scrubber.
 *
 * A time-window control that maps to article freshness (proxy for recency,
 * since freshnessScore decays from publish time). Dragging the handle sets a
 * minimum-freshness threshold: only nodes at least that fresh remain visible.
 * The chosen threshold is reported to the parent via `onWindowChange`, which
 * recomputes the visible slot set and feeds the force-sim worker - the same
 * visibility channel the category/sentiment filters use.
 *
 * Local slider state only; no per-frame work and no Canvas coupling.
 */

import { useState } from "react";
import { Clock } from "lucide-react";

interface EventSequenceTimelineProps {
  /** Called with a minimum-freshness threshold in [0, 1]. */
  onWindowChange?: (minFreshness: number) => void;
}

const STOPS = [
  { value: 0, label: "All" },
  { value: 0.1, label: "3d" },
  { value: 0.3, label: "1d" },
  { value: 0.5, label: "12h" },
  { value: 0.7, label: "6h" },
];

export function EventSequenceTimeline({ onWindowChange }: EventSequenceTimelineProps) {
  const [value, setValue] = useState(0);

  const handle = (v: number) => {
    setValue(v);
    onWindowChange?.(v);
  };

  const activeLabel =
    [...STOPS].reverse().find((s) => value >= s.value)?.label ?? "All";

  return (
    <div className="glass rounded-xl p-3 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-lime" />
          Time window
        </p>
        <span className="text-[11px] text-lime font-medium">{activeLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={0.7}
        step={0.05}
        value={value}
        onChange={(e) => handle(parseFloat(e.target.value))}
        className="w-full accent-lime cursor-pointer"
        aria-label="Time window (minimum freshness)"
      />
      <div className="flex justify-between mt-1">
        {STOPS.map((s) => (
          <button
            key={s.label}
            onClick={() => handle(s.value)}
            className={`text-[9px] transition-colors ${
              activeLabel === s.label ? "text-lime" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
