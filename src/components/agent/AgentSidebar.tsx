"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/store/callStore";
import { useAuth } from "@/hooks/useAuth";
import { getAuth, signOut } from "firebase/auth";
import {
  LayoutDashboard,
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

function toDisplayName(user: { displayName?: string | null; email?: string | null } | null): string {
  const explicit = user?.displayName?.trim();
  if (explicit) {
    return explicit;
  }

  const local = user?.email?.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "Agent";
  }

  return cleaned
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function AgentSidebar() {
  const pathname = usePathname();
  const callId = useCallStore((s) => s.callId);
  const { user } = useAuth();
  const profileName = toDisplayName(user);
  const profileInitial = profileName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(getAuth());
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  return (
    <aside className="w-[236px] h-screen flex flex-col border-r border-slate-200 bg-white/95 backdrop-blur shrink-0">
      {/* Branding */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Zap className="h-4 w-4 text-white" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-slate-900">Aura AI</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">Voice Workspace</p>
          </div>
        </div>
      </div>

      {/* Agent Status */}
      <div className="px-4 py-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                {profileInitial}
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                  callId ? "bg-emerald-500" : "bg-slate-300"
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{profileName}</p>
              <p className="text-[10px] text-slate-400 truncate">Agent Console</p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                callId ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", callId ? "bg-emerald-500" : "bg-slate-400")} />
              {callId ? "Live" : "Ready"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-white" : "text-slate-400"
                )}
              />
              {label}
              {href === "/agent/dashboard" && callId && (
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-3 mt-auto border-t border-slate-100 bg-white/80">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all duration-150"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
