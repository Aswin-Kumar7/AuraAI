"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

function toDisplayName(user: { displayName?: string | null; email?: string | null } | null): string {
  if (user?.displayName) return user.displayName;
  if (user?.email) {
    const local = user.email.split("@")[0];
    return local
      .split(/[._-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return "Admin";
}

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/company/dashboard", icon: LayoutDashboard },
    { name: "Agents", href: "/company/agents", icon: Users },
    { name: "Setup", href: "/company/setup", icon: Settings },
    { name: "Audit", href: "/company/audit", icon: FileText },
    { name: "Analytics", href: "/company/analytics", icon: BarChart3 },
  ];

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-5 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-slate-900 tracking-tight">Aura AI</span>
            <span className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">Company Portal</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors my-1",
                isActive 
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {toDisplayName(user).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-slate-900">
              {toDisplayName(user)}
            </p>
            <p className="text-xs truncate text-slate-400">Company Admin</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setOpen(false);
            signOut();
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl text-sm font-medium text-slate-600 border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden h-16 border-b border-slate-200 bg-white flex items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2.5 ml-4">
          <div className="relative w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">Aura AI</span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={cn("hidden lg:flex w-64 border-r border-slate-200 bg-white flex-col h-full flex-shrink-0", className)}>
        <SidebarContent />
      </div>
    </>
  );
}
