"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { KBEditor } from "@/components/company/KBEditor";
import { Loader2, Play, Settings, Cpu, Database, ShieldAlert, Languages, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Language = "en" | "hi" | "hinglish" | "auto";

interface CompanyConfig {
  companyName: string;
  voiceId: string;
  knowledgeBase: string;
  complianceKeywords: string[];
  alertThreshold: number;
  language: Language;
}

const defaultConfig: CompanyConfig = {
  companyName: "",
  voiceId: "",
  knowledgeBase: "",
  complianceKeywords: [],
  alertThreshold: 50,
  language: "en",
};

export default function SetupPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CompanyConfig>(defaultConfig);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/company/config");
        if (res.ok) {
          const data = await res.json();
          setConfig({ ...defaultConfig, ...data });
        }
      } catch (e: any) {
        toast({ title: "Ops Sync Failed", description: "Could not establish a connection to config cluster.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const saveConfig = async (partial: Partial<CompanyConfig>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/company/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (res.ok) {
        // Quiet success for "seamless" feel
      } else {
        throw new Error("Persist failed");
      }
    } catch (e: any) {
      toast({ title: "Write Conflict", description: "Failed to sync config with cloud store.", variant: "destructive" });
    } finally {
      setTimeout(() => setSaving(false), 800);
    }
  };

  const handleUpdate = (update: Partial<CompanyConfig>) => {
    const next = { ...config, ...update };
    setConfig(next);
    saveConfig(next);
  };

  const alertLabel = useMemo(() => {
    if (config.alertThreshold < 30) return "MAX PREPAREDNESS";
    if (config.alertThreshold <= 60) return "BALANCED OPS";
    return "CONSERVATIVE";
  }, [config.alertThreshold]);

  const handleVoicePreview = async () => {
    if (!config.voiceId) return;
    try {
      setPreviewLoading(true);
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: config.voiceId, text: "Aura AI: Voice synchronization successful." }),
      });
      const data = await res.json();
      if (res.ok) {
        const audio = new Audio(data.audio);
        audio.play();
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 lg:p-10 space-y-10 selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40 uppercase">
               System Genesis
            </h1>
          </div>
          <p className="text-slate-400 font-medium tracking-wide flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            AI BEHAVIORAL PROTOCOLS • ARCHITECTURE DASHBOARD
          </p>
        </div>
        
        <div className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl">
          <div className="text-right">
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Network Status</p>
             <p className={cn("text-xs font-mono font-bold uppercase tracking-widest", saving ? "text-amber-400 animate-pulse" : "text-indigo-400")}>
               {saving ? "UPLOADING CONFIG..." : "SYNCHRONIZED ✓"}
             </p>
          </div>
          <div className="h-10 w-[1px] bg-white/10" />
          <Settings className={cn("h-5 w-5 text-slate-400", saving && "animate-spin")} />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-8 lg:grid-cols-2"
      >
        {/* Profile Card */}
        <div className="space-y-8">
           <section className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl shadow-2xl relative">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <Activity className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                   <h3 className="text-xl font-bold tracking-tight">Enterprise Identity</h3>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Global AI Recognition Header</p>
                </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 ml-1">Company Name</label>
                    <Input 
                      value={config.companyName}
                      onChange={(e) => handleUpdate({ companyName: e.target.value })}
                      placeholder="e.g. Aura Telecom Solutions"
                      className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 font-medium transition-all"
                    />
                 </div>
              </div>
           </section>

           <section className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                   <h3 className="text-xl font-bold tracking-tight">Compliance Protocols</h3>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Anomaly Detection & Sensitivity</p>
                </div>
              </div>

              <div className="space-y-8">
                 <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Alert Sensitivity</label>
                      <span className="text-xs font-black text-rose-400 tracking-tighter">{alertLabel}</span>
                    </div>
                    <Slider 
                       value={[config.alertThreshold]}
                       onValueChange={(vals) => handleUpdate({ alertThreshold: vals[0] })}
                       max={100} step={1}
                       className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-rose-300"
                    />
                 </div>

                 <div className="space-y-4">
                    <div className="flex gap-3">
                      <Input 
                         value={keywordInput}
                         onChange={(e) => setKeywordInput(e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && (config.complianceKeywords.includes(keywordInput) ? setKeywordInput("") : handleUpdate({ complianceKeywords: [...config.complianceKeywords, keywordInput] }))}
                         placeholder="Add Critical Phrase..."
                         className="h-12 flex-1 bg-white/[0.03] border-white/[0.08] rounded-xl text-sm"
                      />
                      <Button className="h-12 px-6 rounded-xl bg-rose-950/30 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all font-bold text-[10px] uppercase tracking-widest">Track</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {config.complianceKeywords.map(kw => (
                         <span key={kw} className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:border-rose-500/30 transition-colors">
                            {kw}
                            <button onClick={() => handleUpdate({ complianceKeywords: config.complianceKeywords.filter(k => k !== kw) })} className="hover:text-rose-400 transition-colors text-lg line-none mb-[2px]">×</button>
                         </span>
                       ))}
                    </div>
                 </div>
              </div>
           </section>
        </div>

        {/* Knowledge & Intel Section */}
        <div className="space-y-8 h-full">
           <section className="h-full p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-3xl shadow-2xl flex flex-col">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Database className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                   <h3 className="text-xl font-bold tracking-tight">Knowledge Cluster</h3>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Base Intelligence Repository</p>
                </div>
              </div>

              <div className="flex-1 min-h-[400px]">
                 <KBEditor
                    value={config.knowledgeBase}
                    onChange={(v) => handleUpdate({ knowledgeBase: v })}
                    onSave={async () => {
                      toast({ title: "KB Indexed", description: "Intelligence repository updated." });
                    }}
                 />
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                 <div className="flex gap-4 items-center">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <Languages className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">Native Engine Language</p>
                      <Select value={config.language} onValueChange={(v: any) => handleUpdate({ language: v })}>
                        <SelectTrigger className="h-10 bg-transparent border-white/[0.08] focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white font-bold uppercase text-[10px] tracking-widest">
                          <SelectItem value="en">English Priming</SelectItem>
                          <SelectItem value="hi">Hindi Priming</SelectItem>
                          <SelectItem value="hinglish">Hinglish Direct</SelectItem>
                          <SelectItem value="auto">System Auto-Detect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                 </div>
              </div>
           </section>
        </div>
      </motion.div>
    </div>
  );
}
