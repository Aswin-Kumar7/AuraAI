"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/hooks/useAuth";
import { getAuth, signOut } from "firebase/auth";
import {
  LayoutDashboard,
  PhoneOutgoing,
  History,
  User,
  Lightbulb,
  LogOut,
  Headphones,
  Zap,
  BookUser,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/phonebook", label: "Phonebook", icon: BookUser },
  { href: "/agent/calls", label: "Call History", icon: History },
  { href: "/agent/profile", label: "Profile", icon: User },
  { href: "/agent/insights", label: "Insights", icon: Lightbulb },
];

export function AgentSidebar() {
  const pathname = usePathname();
  const callId = useCallStore((s) => s.callId);
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(getAuth());
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  return (
    <aside className="w-[220px] h-screen flex flex-col border-r border-white/[0.06] bg-[#0a0e1a]/80 backdrop-blur-xl shrink-0">
      {/* Logo */}
      <div className="p-5 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white">
              Aura
            </span>
            <span className="text-[10px] ml-1 text-indigo-400 font-medium">
              AI
            </span>
          </div>
        </div>
      </div>

      {/* Agent Status */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                <Headphones className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0e1a]",
                  callId
                    ? "bg-emerald-400 shadow-lg shadow-emerald-400/40 animate-pulse"
                    : "bg-slate-500"
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">
                {user?.email?.split("@")[0] || "Agent"}
              </p>
              <p
                className={cn(
                  "text-[10px] font-medium",
                  callId ? "text-emerald-400" : "text-slate-500"
                )}
              >
                {callId ? "On Call" : "Available"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-indigo-400" : ""
                )}
              />
              {label}
              {href === "/agent/dashboard" && callId && (
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-3 mt-auto">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
