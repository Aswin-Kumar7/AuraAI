"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Eye, Search, Filter, Phone, CheckCircle2, Activity, ChevronDown } from "lucide-react";
import CallDetailDrawer from "@/components/agent/CallDetailDrawer";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Call {
  callId: string;
  callerPhone: string;
  issueCategory: string;
  duration: number;
  resolved: boolean;
  createdAt: string;
  status: string;
  summary?: any;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const CALLER_AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getCallerAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CALLER_AVATAR_COLORS[Math.abs(hash) % CALLER_AVATAR_COLORS.length];
}

function getPhoneInitials(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(-2) : phone.slice(0, 2).toUpperCase();
}

function QualityStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn("text-sm leading-none", i < score ? "text-amber-400" : "text-slate-200")}>★</span>
      ))}
    </div>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    startDate: "",
    endDate: "",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCalls = async (page = 1) => {
    setLoading(true);
    try {
      const effectiveFilters = { ...filters, status: filters.status === "all" ? "" : filters.status };
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...Object.fromEntries(
          Object.entries(effectiveFilters).filter(([_, value]) => value !== "")
        ),
      });

      const res = await fetch(`/api/agent/calls?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch calls.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not load calls.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => fetchCalls(1);
  const handlePageChange = (newPage: number) => fetchCalls(newPage);

  const completedCount = calls.filter(c => c.status === "completed").length;
  const activeCount = calls.filter(c => c.status === "active").length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Call History</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review your past interactions and customer sentiment.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {pagination.total} Total
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {completedCount} Completed
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">
            <Activity className="h-3.5 w-3.5" />
            {activeCount} Active
          </div>
        </div>
      </div>

      {/* Collapsible Filters */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="uppercase tracking-wider text-xs text-slate-500 font-semibold">Filters</span>
            {(filters.search || filters.status || filters.startDate || filters.endDate) && (
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", filtersOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-slate-100"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-500 mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Phone or issue..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                      className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-10"
                      onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-900 h-10">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500 mb-1.5 block">Start Date</Label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 h-10"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500 mb-1.5 block">End Date</Label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 h-10"
                    />
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 flex justify-end">
                <Button
                  onClick={applyFilters}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Apply Filters
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Calls Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 hover:bg-transparent bg-slate-50">
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Caller</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Call ID</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider w-[28%]">Issue Overview</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Duration</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Quality</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100">
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-xl bg-slate-200" /><Skeleton className="h-4 w-24 bg-slate-200" /></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-slate-200" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-lg bg-slate-200" /></TableCell>
                </TableRow>
              ))
            ) : calls.length === 0 ? (
              <TableRow className="border-b-transparent hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">No calls found</p>
                    <p className="text-slate-400 text-xs">Adjust your filters or make your first call from the dashboard.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call, idx) => (
                <motion.tr
                  key={call.callId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => { setSelectedCallId(call.callId); setDrawerOpen(true); }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0", getCallerAvatarColor(call.callerPhone))}>
                        {getPhoneInitials(call.callerPhone)}
                      </div>
                      <span className="font-medium text-slate-900 text-sm">{call.callerPhone || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                    {call.callId.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="text-xs font-semibold text-slate-700 block mb-0.5">{call.issueCategory || "Uncategorized"}</span>
                      <span className="text-[11px] text-slate-400 line-clamp-1 flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", call.resolved ? "bg-emerald-500" : "bg-red-400")} />
                        {call.summary?.briefSummary || "No summary available"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 text-xs font-medium">
                    {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase",
                      call.status === "active" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                      call.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      "bg-amber-50 text-amber-700 border border-amber-100"
                    )}>
                      {call.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {call.summary?.callQualityScore ? (
                      <QualityStars score={call.summary.callQualityScore} />
                    ) : (
                      <span className="text-slate-300 text-xs font-mono">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      onClick={(e) => { e.stopPropagation(); setSelectedCallId(call.callId); setDrawerOpen(true); }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-700">{((pagination.page - 1) * pagination.limit) + 1}</span>
            {" "}–{" "}
            <span className="font-semibold text-slate-700">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>
            {" "}of{" "}
            <span className="font-semibold text-slate-700">{pagination.total}</span> calls
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />Prev
            </Button>
            <span className="px-3 text-xs text-slate-500 font-medium">Page {pagination.page} of {pagination.pages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <CallDetailDrawer
        callId={selectedCallId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}