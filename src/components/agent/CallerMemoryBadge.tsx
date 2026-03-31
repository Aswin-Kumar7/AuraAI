"use client";

import { useState, useRef, useEffect } from "react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";
import { History, Plus, ChevronDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

const db = getFirestore();

export function CallerMemoryBadge() {
  const callId = useCallStore((s) => s.callId);
  const isRepeatCaller = useCallStore((s) => s.isRepeatCaller);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchHistory = async () => {
    if (!callId) return;
    try {
      setLoading(true);
      const liveSnap = await getDoc(doc(db, "liveCallState", callId));
      const live = liveSnap.data() as any;
      if (live?.callerHistory) {
        setHistory(live.callerHistory);
      } else {
        setHistory([]);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && history == null) {
      fetchHistory();
    }
  };

  const handleAddNote = async () => {
    if (!callId || !user || !noteInput.trim()) return;
    try {
      const liveSnap = await getDoc(doc(db, "liveCallState", callId));
      const live = liveSnap.data() as any;
      const phone = live?.callerPhone;
      if (!phone) throw new Error("Caller phone unknown.");
      const res = await fetch("/api/memory/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, callerPhone: phone, note: noteInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note");
      toast({ title: "✓ Note saved" });
      setNoteInput("");
      setShowNoteInput(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (!callId) return null;

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all duration-200",
          isRepeatCaller
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
            : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]"
        )}
      >
        <History className="h-3 w-3" />
        {isRepeatCaller ? "Repeat Caller" : "New Caller"}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0d1220] shadow-2xl shadow-black/40 p-4 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/80">
                Caller History
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-white/5"
              >
                <X className="h-3 w-3 text-slate-500" />
              </button>
            </div>

            {/* History List */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 rounded-lg bg-white/[0.04] animate-pulse"
                  />
                ))}
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold text-white/70">
                        {h.issue || "Issue"}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                          h.resolved
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        )}
                      >
                        {h.resolved ? "Resolved" : "Unresolved"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">
                      {h.summary || ""}{" "}
                      {h.date && `· ${new Date(h.date).toLocaleDateString()}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 py-3 text-center">
                No prior history
              </p>
            )}

            {/* Add Note */}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              {showNoteInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/30"
                    onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    autoFocus
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold hover:bg-indigo-500/30 transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Note
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
