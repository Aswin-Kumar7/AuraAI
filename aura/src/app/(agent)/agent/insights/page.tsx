"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Minus, Sparkles, Brain, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

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
      <div className="p-6 max-w-[1200px] mx-auto space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-56 bg-slate-200" />
          <Skeleton className="h-4 w-80 bg-slate-200" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-slate-200" />)}
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Skeleton className="col-span-2 h-72 rounded-xl bg-slate-200" />
          <Skeleton className="h-72 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const chartData = {
    labels: data.chartData?.map((pt: any) => pt.day) || [],
    datasets: [
      {
        label: "Acceptance Rate (%)",
        data: data.chartData?.map((pt: any) => pt.acceptanceRate) || [],
        backgroundColor: "rgba(99, 102, 241, 0.12)",
        borderColor: "rgb(99, 102, 241)",
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: "rgba(99, 102, 241, 0.25)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#fff",
        titleColor: "#1e293b",
        bodyColor: "#64748b",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            const pt = data.chartData?.[ctx.dataIndex];
            return [`${ctx.raw}% acceptance`, `${pt?.callsHandled ?? 0} calls handled`];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: "#f1f5f9" },
        border: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v: any) => `${v}%` },
      },
    },
  };

  const maxIssueCount = Math.max(...(data.topIssues?.map((i: any) => i.count) || [1]), 1);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          AI Performance Insights
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Review your Copilot usage impact and AI-driven skill improvement.</p>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Resolution Rate"
          value={`${data.resolutionRate}%`}
          subtitle="Past 30 days"
          trend="+5%"
          trendPositive={true}
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
          subtitle="Most common evaluation"
          color="amber"
          trend="Consistent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Chart.js Bar Chart */}
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-800">Copilot Acceptance Trend</h3>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100 font-medium">
              Past 7 Days
            </span>
          </div>
          <div style={{ height: 200 }}>
            <Bar data={chartData} options={chartOptions as any} />
          </div>
        </div>

        {/* Top Issues with progress bars */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-5">Common Issues Resolved</h3>
          <div className="space-y-4">
            {data.topIssues?.map((issue: any, index: number) => {
              const pct = Math.round((issue.count / maxIssueCount) * 100);
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                      {issue.name.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-2 shrink-0">{issue.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!data.topIssues || data.topIssues.length === 0) && (
              <div className="text-center py-8 text-slate-400 text-sm">No recorded issues.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, subtitle, trend, trendPositive, color }: {
  icon: any;
  title: string;
  value: any;
  subtitle: string;
  trend?: string;
  trendPositive?: boolean;
  color: "emerald" | "indigo" | "blue" | "amber";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  const TrendIcon = trendPositive === true ? TrendingUp : trendPositive === false ? TrendingDown : Minus;
  const trendColor =
    trendPositive === true ? "text-emerald-600 bg-emerald-50 border-emerald-100"
    : trendPositive === false ? "text-red-600 bg-red-50 border-red-100"
    : "text-slate-500 bg-slate-100 border-slate-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-2 rounded-lg border", colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}
