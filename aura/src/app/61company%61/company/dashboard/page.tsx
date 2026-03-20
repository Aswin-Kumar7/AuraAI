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
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-10 space-y-10 selection:bg-indigo-500/30">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">
              COMMAND CENTER
            </h1>
          </div>
          <p className="text-slate-400 font-medium tracking-wide flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
            LIVE TELEMETRY • AURA AI OPERATIONS
          </p>
        </div>
        
        <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl">
          <div className="text-right">
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">System Health</p>
             <p className="text-sm font-mono font-bold text-emerald-400">OPERATIONAL</p>
          </div>
          <div className="h-10 w-[1px] bg-white/10" />
          <Zap className="h-5 w-5 text-amber-400" />
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
            className="lg:col-span-3 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="px-8 py-6 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
              <h3 className="font-bold text-xl tracking-tight flex items-center gap-3">
                <Clock className="h-5 w-5 text-indigo-400" />
                Recent Intercepts
              </h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Feed</span>
            </div>
            
            <div className="p-2">
              <Table>
                <TableHeader className="bg-white/[0.01]">
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-slate-500 font-bold px-6">CALLER</TableHead>
                    <TableHead className="text-slate-500 font-bold">TOPIC / ISSUE</TableHead>
                    <TableHead className="text-slate-500 font-bold text-right pr-8">DURATION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {calls.map((call, idx) => (
                      <motion.tr 
                        key={call.id || idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-semibold px-6 py-4 text-indigo-200">
                          {call.callerMasked}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-300 font-medium">
                          {call.issue}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                           <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-400">
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
            className="lg:col-span-2 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="px-8 py-6 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
              <h3 className="font-bold text-xl tracking-tight flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Squad Performance
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              {agents.map((agent: any) => (
                <div 
                  key={agent.email} 
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-indigo-500/30 hover:bg-indigo-500/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                      <span className="text-xs font-black">{agent.name?.[0] || 'A'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white tracking-tight">{agent.name || "Agent"}</p>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                       <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Live</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold italic">{agent.callsHandled} cycles</p>
                  </div>
                </div>
              ))}
              
              {agents.length === 0 && !loading && (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Zap className="h-8 w-8 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">No Active Personnel</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
