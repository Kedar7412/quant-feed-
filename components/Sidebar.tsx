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
  Activity,
  LogOut,
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
    <aside className="hidden lg:flex lg:flex-col items-center w-[76px] shrink-0 border-r border-[#2a2a2a] bg-[#0d0d0d] py-5">
      {/* Logo / mark */}
      <Link
        href="/"
        aria-label="QuantFeed home"
        className="group relative flex items-center justify-center h-11 w-11 rounded-full bg-gradient-to-br from-lime to-emerald text-black shadow-[0_0_18px_rgba(163,230,53,0.35)]"
      >
        <Activity className="h-5 w-5" strokeWidth={2.5} />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-3 mt-9 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className="group relative flex items-center justify-center"
            >
              <motion.span
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={`flex items-center justify-center h-11 w-11 rounded-full border transition-colors duration-200 ${
                  isActive
                    ? "bg-lime/15 border-lime/60 text-lime ring-2 ring-lime/30"
                    : "bg-white/[0.03] border-[#242424] text-gray-500 hover:text-gray-200 hover:border-[#3a3a3a]"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
              </motion.span>

              {/* Tooltip */}
              <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1c1c1e] border border-[#2a2a2a] px-2.5 py-1 text-xs text-gray-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Profile / logout pinned at bottom */}
      <button
        type="button"
        aria-label="Profile and sign out"
        title="Profile"
        className="group relative flex items-center justify-center h-11 w-11 rounded-full border border-[#242424] bg-white/[0.03] text-gray-500 hover:text-gray-200 hover:border-[#3a3a3a] transition-colors"
      >
        <LogOut className="h-[18px] w-[18px]" />
        <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1c1c1e] border border-[#2a2a2a] px-2.5 py-1 text-xs text-gray-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-50">
          Profile
        </span>
      </button>
    </aside>
  );
}
