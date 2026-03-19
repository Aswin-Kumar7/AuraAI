"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Sparkles, Brain, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/agent/insights")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => {
        toast({ title: "Failed to load insights", description: e.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white/90 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-400" />
          AI Performance Insights
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review your Copilot usage impact and AI-driven skill improvement.
        </p>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Resolution Rate"
          value={`${data.resolutionRate}%`}
          subtitle="Past 30 days"
          trend="+5%"
          color="emerald"
        />
        <StatCard
          icon={Brain}
          title="AI Suggestions Used"
          value={data.suggestionsUsedCount}
          subtitle="Total accepted"
          trend="High adoption"
          color="indigo"
        />
        <StatCard
          icon={Clock}
          title="AHT Impact"
          value={data.aiImpactScore}
          subtitle="Time saved per call"
          trend="vs branch avg"
          trendPositive={true}
          color="blue"
        />
        <StatCard
          icon={ShieldCheck}
          title="Detected Tone"
          value={data.topTone}
          subtitle="Most common AI evaluation"
          color="amber"
          trend="Consistent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Chart (Mock visualization) */}
        <div className="md:col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h3 className="text-sm font-semibold text-white/80 mb-6 flex items-center justify-between">
            Copilot Acceptance Trend
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full border border-indigo-500/20">
              Past 7 Days
            </span>
          </h3>
          <div className="flex items-end justify-between h-48 mt-4 gap-2">
            {data.chartData?.map((pt: any, i: number) => {
              const height = `${pt.acceptanceRate}%`;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full max-w-10 bg-indigo-500/20 border-t-2 border-indigo-500 rounded-t-sm transition-all duration-300 group-hover:bg-indigo-500/40 relative"
                    style={{ height }}
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0a0e1a] border border-white/[0.08] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 text-white/90 shadow-xl">
                      {pt.acceptanceRate}% Rate
                      <br />
                      <span className="text-slate-500 text-[10px]">{pt.callsHandled} calls</span>
                    </div>
                  </div>
                  <span className="mt-2 text-xs text-slate-500 uppercase font-mono tracking-wider">
                    {pt.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Issues List */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h3 className="text-sm font-semibold text-white/80 mb-6">Common Issues Resolved</h3>
          <div className="space-y-4">
            {data.topIssues?.map((issue: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white/90">
                    {issue.name.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <span className="text-xs text-slate-500">
                    {Math.round((issue.count / data.totalCalls) * 100) || 0}% of volume
                  </span>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-slate-300">
                  {issue.count} calls
                </div>
              </div>
            ))}
            {(!data.topIssues || data.topIssues.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-sm">No recorded issues.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, subtitle, trend, trendPositive, color }: any) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  
  const iconColorMap = {
    emerald: "text-emerald-400",
    indigo: "text-indigo-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-colors relative overflow-hidden group">
      {/* Background glow on hover */}
      <div className={cn("absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 transition-opacity group-hover:opacity-20 pointer-events-none", colorMap[color as keyof typeof colorMap]?.split(" ")[1])} />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-white/90 tracking-tight">{value}</p>
        </div>
        <div className={cn("p-2 rounded-lg border", colorMap[color as keyof typeof colorMap])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">{subtitle}</p>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            trendPositive === true ? "bg-emerald-500/10 text-emerald-400" :
            trendPositive === false ? "bg-red-500/10 text-red-400" :
            "bg-white/[0.06] text-slate-400"
          )}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
