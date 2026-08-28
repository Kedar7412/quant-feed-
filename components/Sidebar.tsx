"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Network,
  Newspaper,
  Brain,
  TrendingUp,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/network", label: "Network Graph", icon: Network },
  { href: "/news", label: "News Feed", icon: Newspaper },
  { href: "/analysis", label: "Analysis", icon: Brain },
  { href: "/predictions", label: "Predictions", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 border-r border-white/[0.06] bg-gradient-to-b from-dark-800/80 to-dark-900/90 backdrop-blur-2xl p-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 mb-6">
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <Zap className="h-7 w-7 text-indigo-400" />
          <div className="absolute inset-0 h-7 w-7 bg-indigo-400/20 blur-lg rounded-full" />
        </motion.div>
        <h1 className="text-xl font-bold gradient-text text-glow">QuantFeed</h1>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />

      {/* Navigation */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? "glass-premium text-indigo-300 shadow-glow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className={`h-4.5 w-4.5 ${isActive ? 'text-indigo-400' : ''}`} />
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />

      {/* AI Status */}
      <div className="px-3 py-3 glass-premium rounded-xl">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">AI Analysis Status</p>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400 shadow-glow-green" />
          </span>
          <span className="text-xs text-gray-300 font-medium">Active</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1.5 ml-5">Last updated 2h ago</p>
      </div>
    </aside>
  );
}
