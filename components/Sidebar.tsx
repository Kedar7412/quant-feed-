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
    <aside className="hidden lg:flex lg:flex-col w-64 border-r border-white/10 glass p-4">
      <div className="flex items-center gap-2 px-3 py-4 mb-6">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Zap className="h-7 w-7 text-indigo-400" />
        </motion.div>
        <h1 className="text-xl font-bold gradient-text">QuantFeed</h1>
      </div>
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? "glass-strong text-indigo-300"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-indigo-400 to-purple-400 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 pt-4 mt-4">
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500">AI Analysis Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-glow" />
            <span className="text-xs text-gray-400">Active - Updated 2h ago</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
