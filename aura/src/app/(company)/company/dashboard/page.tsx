"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/company/StatCard";
import { Users, Phone, Clock, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, callsRes, agentsRes] = await Promise.all([
          fetch("/api/company/stats"),
          fetch("/api/company/calls?limit=5"),
          fetch("/api/company/agents")
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (callsRes.ok) setCalls(await callsRes.json());
        if (agentsRes.ok) {
           const agentsData = await agentsRes.json();
           setAgents(agentsData.slice(0, 5)); 
        }
      } catch (error) {
        toast({
          title: "Error fetching data",
          description: "Could not load dashboard data.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your call center metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Agents Online" value={stats?.agentsOnline ?? "--"} icon={Users} />
            <StatCard title="Calls Today" value={stats?.callsToday ?? "--"} icon={Phone} />
            <StatCard title="Avg AHT" value={stats?.avgAHT ? `${stats.avgAHT}s` : "--"} icon={Clock} />
            <StatCard title="Avg CSAT" value={stats?.avgCSAT ? `${stats.avgCSAT}/5` : "--"} icon={Star} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border rounded-xl p-4 bg-white dark:bg-zinc-950 shadow-sm overflow-x-auto">
          <h3 className="font-semibold text-lg mb-4">Live Agents</h3>
          {loading ? (
            <div className="space-y-3">
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : agents.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed rounded-lg">
               <p className="text-sm text-muted-foreground">No agents found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent: any) => (
                  <TableRow key={agent.email}>
                    <TableCell className="font-medium">{agent.name || "Agent"}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[120px]">{agent.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Online
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border rounded-xl p-4 bg-white dark:bg-zinc-950 shadow-sm overflow-x-auto">
          <h3 className="font-semibold text-lg mb-4">Recent Calls</h3>
          {loading ? (
             <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
             </div>
          ) : calls.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed rounded-lg">
               <p className="text-sm text-muted-foreground">No recent calls today.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call: any, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{call.callerMasked}</TableCell>
                    <TableCell>{call.issue}</TableCell>
                    <TableCell className="text-muted-foreground">{call.duration}s</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
