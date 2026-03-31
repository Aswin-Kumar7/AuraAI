import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Shield, User, Circle, Activity, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AgentRowProps {
  email: string;
  name: string;
  role: "agent" | "admin";
  status: "online" | "on-call" | "offline";
  callsHandled: number;
  addedAt: string | null;
  onRemove: (email: string) => void;
  onRoleChange: (email: string, role: "agent" | "admin") => void;
  disabled?: boolean;
}

export default function AgentRow({
  email,
  name,
  role,
  status,
  callsHandled,
  onRemove,
  onRoleChange,
  disabled,
}: AgentRowProps) {
  
  const isOnline = status === "online";
  const isOnCall = status === "on-call";

  return (
    <motion.tr 
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      <TableCell className="px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
            <User className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white tracking-tight leading-tight">{name || "Unnamed Agent"}</span>
            <span className="text-[10px] font-mono font-bold text-slate-500 tracking-wider truncate max-w-[150px] uppercase">
              {email}
            </span>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest",
          role === "admin" 
            ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
        )}>
          {role === "admin" ? <Shield className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
          {role}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {isOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={cn(
              "relative inline-flex rounded-full h-3 w-3 border border-black/20",
              isOnline ? "bg-emerald-500" : isOnCall ? "bg-amber-500" : "bg-slate-700"
            )} />
          </div>
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            isOnline ? "text-emerald-400" : isOnCall ? "text-amber-400" : "text-slate-500"
          )}>
            {status}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-right pr-12">
        <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
          <Select
            value={role}
            onValueChange={(v) => onRoleChange(email, v as "agent" | "admin")}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-[140px] bg-white/[0.03] border-white/[0.06] rounded-lg text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-indigo-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10 text-white">
              <SelectItem value="agent" className="text-[10px] font-bold uppercase">Field Agent</SelectItem>
              <SelectItem value="admin" className="text-[10px] font-bold uppercase">Operations Admin</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(email)}
            disabled={disabled}
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </motion.tr>
  );
}
