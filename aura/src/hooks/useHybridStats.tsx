/**
 * Hook to monitor hybrid transcription statistics for a call
 *
 * Fetches real-time stats showing performance of browser vs backend transcription.
 */

import { useEffect, useState } from "react";

export interface HybridStats {
  callId: string;
  totalTranscriptions: number;
  browserTranscriptions: number;
  backendTranscriptions: number;
  avgBrowserLatency: number;
  avgBackendLatency: number;
  latestTranscript: {
    speaker: string;
    text: string;
    source: string;
    latency: number;
    timestamp: string;
  } | null;
  hybridStats: {
    browserFaster: boolean;
    latencySavings: number;
  };
}

export function useHybridStats(callId: string | null, pollInterval = 5000) {
  const [stats, setStats] = useState<HybridStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) {
      setStats(null);
      setError(null);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/transcription/hybrid?callId=${encodeURIComponent(callId)}`
        );

        if (response.status === 404) {
          setError("Call not found");
          setStats(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = (await response.json()) as HybridStats;
        setStats(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        console.error("[HybridStats] Error:", message);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
    const interval = setInterval(() => {
      void fetchStats();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [callId, pollInterval]);

  return {
    stats,
    loading,
    error,
    browserIsFaster: stats?.hybridStats.browserFaster ?? false,
    latencySavings: stats?.hybridStats.latencySavings ?? 0,
    totalTranscriptions: stats?.totalTranscriptions ?? 0,
  };
}

export function HybridStatsPanel({ callId }: { callId: string | null }) {
  const { stats, loading, error } = useHybridStats(callId);

  if (!callId || !stats) {
    return null;
  }

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Stats unavailable: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        Loading stats...
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
      <div className="font-semibold text-blue-900">Hybrid Performance</div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-blue-100 bg-white p-2">
          <div className="font-medium text-blue-700">Browser</div>
          <div className="text-gray-600">
            {stats.browserTranscriptions} transcriptions
          </div>
          <div className="text-gray-600">
            {stats.browserTranscriptions > 0
              ? `${Math.round(stats.avgBrowserLatency)}ms avg`
              : "No data"}
          </div>
        </div>

        <div className="rounded border border-green-100 bg-white p-2">
          <div className="font-medium text-green-700">Backend</div>
          <div className="text-gray-600">
            {stats.backendTranscriptions} transcriptions
          </div>
          <div className="text-gray-600">
            {stats.backendTranscriptions > 0
              ? `${Math.round(stats.avgBackendLatency)}ms avg`
              : "No data"}
          </div>
        </div>
      </div>

      {stats.hybridStats.browserFaster && stats.hybridStats.latencySavings > 0 && (
        <div className="rounded border border-green-300 bg-green-100 p-2 text-xs font-medium text-green-800">
          Browser is {stats.hybridStats.latencySavings}ms faster on average
        </div>
      )}

      {stats.latestTranscript && (
        <div className="rounded border border-gray-200 bg-white p-2 text-xs">
          <div className="font-medium text-gray-700">Latest</div>
          <div className="truncate italic text-gray-600">
            "{stats.latestTranscript.text}"
          </div>
          <div className="text-xs text-gray-500">
            {stats.latestTranscript.speaker} • {stats.latestTranscript.source} • {stats.latestTranscript.latency}ms
          </div>
        </div>
      )}
    </div>
  );
}
