"use client";

import { useEffect, useState } from "react";
import AgentRow from "@/components/company/AgentRow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, UserPlus, ShieldPlus, Users, Activity, Trash2, Key } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";

const addAgentSchema = z.object({
  email: z.string().email("Email must be valid"),
  role: z.enum(["agent", "admin"], { message: "Role required" }),
});

type Agent = {
  email: string;
  name: string;
  role: "agent" | "admin";
  status: "online" | "on-call" | "offline";
  callsHandled: number;
  addedAt: string | null;
};

export default function AgentsPage() {
  const { companyId, role: currentRole, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowBusyEmail, setRowBusyEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof addAgentSchema>>({
    resolver: zodResolver(addAgentSchema),
    mode: "onChange",
    defaultValues: { email: "", role: "agent" },
  });

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/company/agents");
      if (!res.ok) throw new Error("Sync failed");
      setAgents(await res.json());
    } catch {
      toast({ title: "Ops Sync Failed", description: "Failed to load agent telemetry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (currentRole !== "admin" && currentRole !== "company_admin") {
      setLoading(false);
      return;
    }
    fetchAgents();
    const id = setInterval(fetchAgents, 30_000);
    return () => clearInterval(id);
  }, [authLoading, currentRole]);

  const handleAddAgent = async (values: z.infer<typeof addAgentSchema>) => {
    if (!companyId) return;
    try {
      const res = await fetch("/api/company/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, role: values.role, companyId }),
      });
      if (res.ok) {
        toast({ title: "Agent Whitelisted", description: "Access has been granted." });
        form.reset({ email: "", role: "agent" });
        fetchAgents();
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to add agent");
      }
    } catch (e: any) {
      toast({ title: "Authorization Denied", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Revoke access for ${email}?`)) return;
    setRowBusyEmail(email);
    try {
      const res = await fetch(`/api/company/whitelist?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Access Revoked", description: "Agent removed from squad." });
        setAgents((prev) => prev.filter((a) => a.email !== email));
      }
    } finally {
      setRowBusyEmail(null);
    }
  };

  const handleRoleChange = async (email: string, nextRole: Agent["role"]) => {
    setRowBusyEmail(email);
    try {
      const res = await fetch("/api/company/whitelist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: nextRole }),
      });
      if (res.ok) toast({ title: "Rank Updated", description: "Privileges adjusted." });
      fetchAgents();
    } finally {
      setRowBusyEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-10 space-y-10 selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">
              SQUAD MANAGEMENT
            </h1>
          </div>
          <p className="text-slate-400 font-medium tracking-wide flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            PERSONNEL DIRECTORY • AUTHORIZATION CONTROL
          </p>
        </div>
      </div>

      {/* Add Agent Form - Premium Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-4xl p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <UserPlus className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Deploy Personnel</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Whitelists new credentials to the company cluster</p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleAddAgent)}
            className="flex flex-col sm:flex-row gap-6 items-end"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1 w-full space-y-3">
                  <FormLabel className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Credential Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="agent.name@aura.ai"
                      className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-bold text-rose-500" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="w-full sm:w-60 space-y-3">
                  <FormLabel className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Security Clearance</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl focus:ring-1 focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="agent" className="focus:bg-indigo-500/10 focus:text-indigo-400">Field Agent</SelectItem>
                      <SelectItem value="admin" className="focus:bg-rose-500/10 focus:text-rose-400">Operations Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              className="h-12 w-full sm:w-auto px-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black tracking-widest text-[10px] uppercase shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all"
            >
              {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "DEPLOY"}
            </Button>
          </form>
        </Form>
      </motion.div>

      {/* Agents Table - Premium List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl overflow-hidden shadow-2xl"
      >
        <div className="px-8 py-6 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-xl tracking-tight">Active Personnel</h3>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] font-black uppercase tracking-widest text-slate-400">
            {agents.length} Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.01]">
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Security Rank</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operation Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right pr-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-white/[0.04]">
                      <TableCell className="px-8 py-6"><Skeleton className="h-8 w-48 bg-white/5 rounded-lg" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-white/5 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 bg-white/5 rounded-full" /></TableCell>
                      <TableCell className="text-right pr-12"><Skeleton className="h-8 w-8 ml-auto bg-white/5 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-60 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-20">
                        <Users className="h-12 w-12" />
                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">No active personnel detected</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map(agent => (
                    <AgentRow 
                      key={agent.email} 
                      {...agent} 
                      onRemove={handleRemove} 
                      onRoleChange={handleRoleChange}
                      disabled={rowBusyEmail === agent.email}
                    />
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
