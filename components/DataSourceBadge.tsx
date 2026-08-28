"use client";

import { motion } from "framer-motion";

interface DataSourceBadgeProps {
  dataSource: "live" | "cached" | "sample";
}

export function DataSourceBadge({ dataSource }: DataSourceBadgeProps) {
  const config = {
    live: {
      dotColor: "bg-green-400",
      textColor: "text-green-400",
      borderColor: "border-green-400/30",
      bgColor: "bg-green-400/10",
      label: "Live",
      pulse: true,
    },
    cached: {
      dotColor: "bg-amber-400",
      textColor: "text-amber-400",
      borderColor: "border-amber-400/30",
      bgColor: "bg-amber-400/10",
      label: "Cached",
      pulse: false,
    },
    sample: {
      dotColor: "bg-gray-400",
      textColor: "text-gray-400",
      borderColor: "border-gray-400/30",
      bgColor: "bg-gray-400/10",
      label: "Sample Data",
      pulse: false,
    },
  };

  const { dotColor, textColor, borderColor, bgColor, label, pulse } =
    config[dataSource];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${borderColor} ${bgColor}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}
        />
      </span>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
    </motion.div>
  );
}
