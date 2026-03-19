"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";
import { useEffect, useState, useMemo } from "react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

export function SentimentGraph() {
  const sentimentScore = useCallStore((s) => s.sentimentScore);
  const sentimentLabel = useCallStore((s) => s.sentimentLabel);
  const sentimentArc = useCallStore((s) => s.sentimentArc) || [];

  const points = sentimentArc.slice(-30);

  const currentScore = points.length > 0 ? points[points.length - 1] : null;

  const sentimentColor = useMemo(() => {
    if (currentScore === null) return "text-slate-500";
    if (currentScore >= 60) return "text-emerald-400";
    if (currentScore >= 40) return "text-amber-400";
    return "text-red-400";
  }, [currentScore]);

  const sentimentEmoji = useMemo(() => {
    if (!sentimentLabel) return "—";
    const map: Record<string, string> = {
      calm: "😊",
      happy: "😊",
      resolved: "✅",
      neutral: "😐",
      tense: "😬",
      frustrated: "😤",
      escalating: "🔴",
    };
    return map[sentimentLabel] || "😐";
  }, [sentimentLabel]);

  const data = useMemo(() => {
    return {
      labels: points.map((_, i) => i + 1),
      datasets: [
        {
          data: points,
          borderColor: "rgba(129, 140, 248, 1)",
          borderWidth: 2,
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(129, 140, 248, 0.1)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            gradient.addColorStop(0, "rgba(129, 140, 248, 0.25)");
            gradient.addColorStop(0.5, "rgba(129, 140, 248, 0.08)");
            gradient.addColorStop(1, "rgba(129, 140, 248, 0)");
            return gradient;
          },
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "rgba(129, 140, 248, 1)",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
        },
      ],
    };
  }, [points]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: {
        intersect: false,
        mode: "index" as const,
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: true,
          min: 0,
          max: 100,
          grid: {
            color: "rgba(255,255,255,0.03)",
          },
          ticks: {
            color: "rgba(255,255,255,0.2)",
            font: { size: 9 },
            stepSize: 25,
            callback: (value: any) => {
              const labels: Record<number, string> = {
                0: "😤",
                25: "😬",
                50: "😐",
                75: "😊",
                100: "🎉",
              };
              return labels[value] || "";
            },
          },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleColor: "rgba(255,255,255,0.7)",
          bodyColor: "#fff",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: (ctx: any) => `Sentiment: ${ctx.parsed.y}/100`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">
            Sentiment
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentScore !== null && (
            <>
              <span className="text-lg">{sentimentEmoji}</span>
              <span className={cn("text-sm font-bold tabular-nums", sentimentColor)}>
                {currentScore}
              </span>
              <span className="text-[10px] text-slate-500 capitalize">
                {sentimentLabel || ""}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-28 px-3 py-2">
        {points.length > 0 ? (
          <Line data={data} options={options as any} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-slate-600">
              Sentiment trend will appear as the call progresses
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
