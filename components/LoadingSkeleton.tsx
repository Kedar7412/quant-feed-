"use client";

import { motion } from "framer-motion";

export function CardSkeleton() {
  return (
    <div className="glass-premium rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded-full shimmer-loading" />
        <div className="h-4 w-20 rounded shimmer-loading" />
      </div>
      <div className="h-4 w-3/4 rounded shimmer-loading" />
      <div className="h-3 w-full rounded shimmer-loading" />
      <div className="h-3 w-5/6 rounded shimmer-loading" />
      <div className="flex items-center gap-3 pt-2">
        <div className="h-3 w-16 rounded shimmer-loading" />
        <div className="h-3 w-20 rounded shimmer-loading" />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="glass-premium rounded-xl p-4 space-y-3">
      <div className="h-5 w-5 rounded shimmer-loading" />
      <div className="h-7 w-12 rounded shimmer-loading" />
      <div className="h-3 w-24 rounded shimmer-loading" />
    </div>
  );
}

export function GraphSkeleton() {
  return (
    <div className="flex-1 glass-premium rounded-xl overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64">
          {/* Animated pulsing nodes */}
          {[
            { x: '50%', y: '30%', delay: 0 },
            { x: '25%', y: '55%', delay: 0.2 },
            { x: '75%', y: '50%', delay: 0.4 },
            { x: '40%', y: '75%', delay: 0.6 },
            { x: '65%', y: '20%', delay: 0.8 },
            { x: '30%', y: '35%', delay: 1.0 },
            { x: '80%', y: '70%', delay: 1.2 },
          ].map((node, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-lime/30"
              style={{ left: node.x, top: node.y }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 2,
                delay: node.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full opacity-20">
            <line x1="50%" y1="30%" x2="25%" y2="55%" stroke="#a3e635" strokeWidth="1" />
            <line x1="50%" y1="30%" x2="75%" y2="50%" stroke="#a3e635" strokeWidth="1" />
            <line x1="25%" y1="55%" x2="40%" y2="75%" stroke="#a3e635" strokeWidth="1" />
            <line x1="75%" y1="50%" x2="80%" y2="70%" stroke="#a3e635" strokeWidth="1" />
            <line x1="65%" y1="20%" x2="50%" y2="30%" stroke="#a3e635" strokeWidth="1" />
            <line x1="30%" y1="35%" x2="25%" y2="55%" stroke="#a3e635" strokeWidth="1" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <p className="text-sm text-gray-500 animate-pulse">Loading network graph...</p>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded shimmer-loading" />
          <div className="h-4 w-64 rounded shimmer-loading" />
        </div>
        <div className="h-7 w-24 rounded-full shimmer-loading" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      {/* Content */}
      <div className="glass-premium rounded-xl p-6 space-y-4">
        <div className="h-5 w-48 rounded shimmer-loading" />
        <div className="h-4 w-full rounded shimmer-loading" />
        <div className="h-4 w-3/4 rounded shimmer-loading" />
        <div className="grid grid-cols-3 gap-3 pt-4">
          <div className="h-20 rounded-lg shimmer-loading" />
          <div className="h-20 rounded-lg shimmer-loading" />
          <div className="h-20 rounded-lg shimmer-loading" />
        </div>
      </div>
    </div>
  );
}

export function NewsListSkeleton() {
  return (
    <div className="space-y-3 animate-fadeIn">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function PredictionsSkeleton() {
  return (
    <div className="space-y-3 animate-fadeIn">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-premium rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 rounded-full shimmer-loading" />
                <div className="h-4 w-20 rounded shimmer-loading" />
              </div>
              <div className="h-4 w-3/4 rounded shimmer-loading" />
              <div className="h-3 w-full rounded shimmer-loading" />
            </div>
            <div className="w-14 h-14 rounded-full shimmer-loading" />
          </div>
        </div>
      ))}
    </div>
  );
}
