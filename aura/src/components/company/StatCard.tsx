import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export default function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  return (
    <div className={cn(
      "relative group overflow-hidden p-6 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl transition-all duration-300 hover:border-indigo-500/30 hover:bg-white/[0.04] shadow-2xl",
      className
    )}>
      {/* Background Decor */}
      <div className="absolute -right-4 -top-4 h-24 w-24 bg-white/[0.02] rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

      <div className="flex flex-row items-center justify-between mb-4">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">
          {title}
        </p>
        <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:scale-110 transition-transform">
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
      </div>
      
      <div className="space-y-1">
        <h4 className="text-3xl font-black tracking-tighter text-white">
          {value}
        </h4>
        {description && (
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
