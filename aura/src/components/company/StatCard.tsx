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
      "relative group overflow-hidden p-6 rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:shadow-md hover:border-slate-300",
      className
    )}>
      <div className="flex flex-row items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-none">
          {title}
        </p>
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 group-hover:scale-110 transition-transform">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
      </div>
      
      <div className="space-y-1">
        <h4 className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </h4>
        {description && (
          <p className="text-[11px] text-slate-400 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
