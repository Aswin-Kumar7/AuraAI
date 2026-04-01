"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/company/StatCard";
import { Users, Phone, Clock, Star, Activity, ArrowUpRight, ShieldCheck, Zap } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
          fetch("/api/company/calls?limit=8"),
          fetch("/api/company/agents")
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (callsRes.ok) setCalls(await callsRes.json());
        if (agentsRes.ok) {
           const agentsData = await agentsRes.json();
           setAgents(agentsData.slice(0, 8)); 
        }
      } catch (error) {
        toast({
          title: "Telemetry Sync Failed",
          description: "Could not establish a connection to the data layer.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000); // Polling for "live" feel
    return () => clearInterval(interval);
  }, [toast]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen text-slate-900 p-6 lg:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Command Center
          </h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            Live telemetry • Aura AI Operations
          </p>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm">
          <div className="text-right">
             <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">System Health</p>
             <p className="text-sm font-bold text-emerald-600">Operational</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <Zap className="h-5 w-5 text-amber-500" />
        </div>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-10"
      >
        {/* Main Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Active Agents" 
            value={stats?.agentsOnline ?? 0} 
            icon={Users} 
            description="Available for new sessions"
            className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20"
          />
          <StatCard 
            title="Daily Call Volume" 
            value={stats?.callsToday ?? 0} 
            icon={Phone} 
            description="Total interactions since 00:00"
            className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20"
          />
          <StatCard 
            title="Avg Handle Time" 
            value={stats?.avgAHT ? `${stats.avgAHT}s` : "0s"} 
            icon={Clock} 
            description="Average session duration"
            className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20"
          />
          <StatCard 
            title="Service Sentiment" 
            value={stats?.avgCSAT ? `${stats.avgCSAT}/5` : "5.0/5"} 
            icon={Star} 
            description="AI-derived customer satisfaction"
            className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20"
          />
        </div>

        {/* Operational Intelligence Tables */}
        <div className="grid gap-8 lg:grid-cols-5">
          <motion.div 
            variants={itemVariants}
            className="lg:col-span-3 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur overflow-hidden shadow-sm"
          >
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                Recent Calls
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Live Feed</span>
            </div>
            
            <div className="p-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-semibold px-6 text-xs">CALLER</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-xs">TOPIC</TableHead>
                    <TableHead className="text-slate-400 font-semibold text-right pr-8 text-xs">DURATION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {calls.map((call, idx) => (
                      <motion.tr 
                        key={call.id || idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-semibold px-6 py-4 text-indigo-600">
                          {call.callerMasked}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-600 font-medium text-sm">
                          {call.issue}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                           <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-500">
                             {call.duration}s
                           </span>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </motion.div>

          {/* Active Agents Card */}
          <motion.div 
            variants={itemVariants}
            className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur overflow-hidden shadow-sm"
          >
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Agent Performance
              </h3>
            </div>
            
            <div className="p-5 space-y-3">
              {agents.map((agent: any) => (
                <div 
                  key={agent.email} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <span className="text-xs font-bold text-indigo-700">{agent.name?.[0] || 'A'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{agent.name || "Agent"}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                       <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[10px] font-semibold text-emerald-600">Live</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{agent.callsHandled} calls</p>
                  </div>
                </div>
              ))}
              
              {agents.length === 0 && !loading && (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Zap className="h-8 w-8 opacity-20" />
                  <p className="text-xs font-medium">No active agents</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
