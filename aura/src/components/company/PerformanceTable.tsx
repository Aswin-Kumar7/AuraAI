"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface AgentStat {
  agentId: string;
  agentName: string;
  calls: number;
  avgAHT: number;
  avgCSAT: number;
  resolvedRate: number;
  suggestionsUsedRate: number;
}

interface PerformanceTableProps {
  data: AgentStat[];
}

type SortField = keyof AgentStat;
type SortOrder = 'asc' | 'desc';

export default function PerformanceTable({ data }: PerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('calls');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const formatAHT = (seconds: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('agentName')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Agent
                {getSortIcon('agentName')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('calls')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Calls
                {getSortIcon('calls')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('avgAHT')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Avg AHT
                {getSortIcon('avgAHT')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('avgCSAT')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                CSAT
                {getSortIcon('avgCSAT')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('suggestionsUsedRate')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Suggestions Used %
                {getSortIcon('suggestionsUsedRate')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('resolvedRate')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                FCR %
                {getSortIcon('resolvedRate')}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                No agent data available.
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((stat) => (
              <TableRow key={stat.agentId}>
                <TableCell className="font-medium">{stat.agentName}</TableCell>
                <TableCell>{stat.calls}</TableCell>
                <TableCell>{formatAHT(stat.avgAHT)}</TableCell>
                <TableCell>{stat.avgCSAT ? `${stat.avgCSAT}/5` : "N/A"}</TableCell>
                <TableCell>{stat.suggestionsUsedRate}%</TableCell>
                <TableCell>{stat.resolvedRate}%</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}