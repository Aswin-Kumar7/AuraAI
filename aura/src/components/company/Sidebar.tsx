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
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

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
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-gray-900 dark:text-gray-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-lg font-bold shadow-sm">
            A
          </div>
          Aura
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
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors my-1",
                isActive 
                  ? "bg-indigo-500 text-white shadow-sm" 
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 dark:text-gray-500")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="w-10 h-10 border border-gray-200 dark:border-zinc-800">
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "A"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
              {user?.displayName || "Admin User"}
            </p>
            <p className="text-xs truncate text-gray-500 dark:text-gray-400">
              {user?.email || "admin@company.com"}
            </p>
          </div>
        </div>
        <button 
          onClick={() => {
            setOpen(false);
            signOut();
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <LogOut className="w-4 h-4 text-gray-400" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden h-16 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center px-4">
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
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-gray-900 dark:text-gray-100 ml-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-lg font-bold shadow-sm">
            A
          </div>
          Aura
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={cn("hidden lg:flex w-64 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-col h-full flex-shrink-0", className)}>
        <SidebarContent />
      </div>
    </>
  );
}
