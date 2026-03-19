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
import { ChevronLeft, ChevronRight, Eye, Search, Filter } from "lucide-react";
import CallDetailDrawer from "@/components/agent/CallDetailDrawer";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
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

  const applyFilters = () => {
    fetchCalls(1);
  };

  const handlePageChange = (newPage: number) => {
    fetchCalls(newPage);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white/90">Call History</h1>
          <p className="text-sm text-slate-400 mt-1">Review your past interactions and customer sentiment.</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="search" className="text-xs text-slate-500 mb-1.5 block">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="search"
                placeholder="Phone or issue..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9 bg-white/[0.04] border-white/[0.08] text-white focus:border-indigo-500/50 h-10"
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="status" className="text-xs text-slate-500 mb-1.5 block">Status</Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-10">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0e1a] border-white/[0.08]">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-4">
            <div className="flex-1">
              <Label htmlFor="startDate" className="text-xs text-slate-500 mb-1.5 block">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white h-10"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate" className="text-xs text-slate-500 mb-1.5 block">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white h-10"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button 
            onClick={applyFilters}
            className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          >
            <Filter className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Calls Table */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02] hover:bg-white/[0.02]">
            <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Call ID</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Phone</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs w-[30%]">Issue Overview</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Duration</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Status</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Quality</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell><Skeleton className="h-4 w-16 bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 bg-white/[0.06]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md bg-white/[0.06]" /></TableCell>
                </TableRow>
              ))
            ) : calls.length === 0 ? (
              <TableRow className="border-b-transparent hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-16 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Search className="h-8 w-8 opacity-20" />
                    <p>No calls found matching your criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow 
                  key={call.callId} 
                  className="border-b-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  onClick={() => {
                    setSelectedCallId(call.callId);
                    setDrawerOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">
                    {call.callId.slice(-8)}
                  </TableCell>
                  <TableCell className="font-medium text-white/90">{call.callerPhone}</TableCell>
                  <TableCell>
                    <div>
                      <span className="text-xs font-semibold text-white/80 block mb-0.5">
                        {call.issueCategory || "Uncategorized"}
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1 break-all flex items-center gap-2">
                         {call.resolved ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                         ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500/80" />
                         )}
                         {call.summary?.briefSummary || "No summary available"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase",
                      call.status === "active" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      call.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    )}>
                      {call.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {call.summary?.callQualityScore ? (
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "flex h-5 items-center justify-center rounded-md px-1.5 text-xs font-bold",
                          call.summary.callQualityScore >= 4 ? "bg-emerald-500/20 text-emerald-400" :
                          call.summary.callQualityScore >= 3 ? "bg-amber-500/20 text-amber-400" :
                          "bg-red-500/20 text-red-400"
                        )}>
                          {call.summary.callQualityScore}/5
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-mono text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white hover:bg-white/[0.08]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCallId(call.callId);
                        setDrawerOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-xs text-slate-500">
            Showing <span className="text-white/80 font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="text-white/80 font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-white/80 font-medium">{pagination.total}</span> calls
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="bg-transparent border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <div className="px-4 text-xs font-medium text-slate-400">
              Page {pagination.page} of {pagination.pages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="bg-transparent border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.04]"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <CallDetailDrawer
        callId={selectedCallId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}