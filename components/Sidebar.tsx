"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <aside className="hidden lg:flex lg:flex-col w-64 border-r border-gray-800 bg-[#0d0d14] p-4">
      <div className="flex items-center gap-2 px-3 py-4 mb-6">
        <Zap className="h-7 w-7 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">QuantFeed</h1>
      </div>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-800 pt-4 mt-4">
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500">AI Analysis Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Active - Updated 2h ago</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
