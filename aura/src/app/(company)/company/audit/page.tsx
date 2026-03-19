"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditTable, AuditLogRow } from "@/components/company/AuditTable";

interface AgentOption {
  id: string;
}

interface ApiResponse {
  data: any[];
  total: number;
  page: number;
}

const ALL_AGENTS_VALUE = "__all__";

export default function AuditPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [agentId, setAgentId] = useState<string>(ALL_AGENTS_VALUE);
  const [callId, setCallId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [agents, setAgents] = useState<AgentOption[]>([]);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / 25), 1), [total]);

  const fetchLogs = async (opts?: { page?: number }) => {
    const nextPage = opts?.page ?? page;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      if (agentId && agentId !== ALL_AGENTS_VALUE) params.set("agentId", agentId);
      if (callId) params.set("callId", callId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/company/audit?${params.toString()}`);
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error || "Failed to load audit logs");
      }
      setLogs(
        data.data.map((d: any) => ({
          _id: String(d._id),
          timestamp: d.timestamp,
          agentId: d.agentId,
          callerMasked: d.callerMasked,
          aiSuggestion: d.aiSuggestion,
          suggestionRank: d.suggestionRank,
          agentUsed: d.agentUsed,
          agentResponse: d.agentResponse,
        }))
      );
      setTotal(data.total);
      setPage(data.page);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // derive agents list from logs on first load; in real system we'd have dedicated API
    const uniqueAgents = Array.from(new Set(logs.map((l) => l.agentId))).map((id) => ({ id }));
    setAgents(uniqueAgents);
  }, [logs]);

  useEffect(() => {
    fetchLogs({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    fetchLogs({ page: 1 });
  };

  const handleExportCsv = () => {
    if (!logs.length) return;
    const header = [
      "timestamp",
      "agentId",
      "callerMasked",
      "aiSuggestion",
      "suggestionRank",
      "agentUsed",
      "agentResponse",
    ];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.agentId,
      l.callerMasked ?? "",
      l.aiSuggestion.replace(/\n/g, " "),
      String(l.suggestionRank),
      l.agentUsed ? "yes" : "no",
      (l.agentResponse || "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `audit-log-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const usedCount = logs.filter((l) => l.agentUsed).length;
  const usedPct = logs.length ? Math.round((usedCount / logs.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-muted-foreground">
            Review how agents used Aura&apos;s suggestions across calls.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          <span>AI suggestions used: {usedPct}%</span>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="space-y-1 w-full md:w-48">
            <label className="text-xs font-medium">Agent</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_AGENTS_VALUE}>All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem value={a.id} key={a.id}>
                    {a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 w-full md:w-44">
            <label className="text-xs font-medium">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="space-y-1 w-full md:w-44">
            <label className="text-xs font-medium">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="space-y-1 w-full md:w-56">
            <label className="text-xs font-medium">Call ID</label>
            <Input
              value={callId}
              onChange={(e) => setCallId(e.target.value)}
              placeholder="Search by call ID"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleApplyFilters}>
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={handleExportCsv} disabled={!logs.length}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No audit logs yet</div>
          ) : (
            <AuditTable rows={logs} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page} of {totalPages} • {total} records
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchLogs({ page: page - 1 })}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => fetchLogs({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

