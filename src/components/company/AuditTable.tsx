"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AuditLogRow {
  _id: string;
  timestamp: string;
  agentId: string;
  callerMasked?: string;
  aiSuggestion: string;
  suggestionRank: number;
  agentUsed: boolean;
  agentResponse: string;
}

interface AuditTableProps {
  rows: AuditLogRow[];
}

function rankVariant(rank: number): "default" | "secondary" | "outline" {
  if (rank === 1) return "default"; // indigo via primary
  if (rank === 2) return "secondary"; // gray
  return "outline"; // light gray
}

export function AuditTable({ rows }: AuditTableProps) {
  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Caller</TableHead>
            <TableHead>AI Suggestion</TableHead>
            <TableHead>Rank</TableHead>
            <TableHead>Used</TableHead>
            <TableHead>Agent Response</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id}>
              <TableCell className="whitespace-nowrap text-xs">
                {new Date(row.timestamp).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{row.agentId}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.callerMasked || "-"}
              </TableCell>
              <TableCell className="max-w-xs text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="line-clamp-2 cursor-help">
                      {row.aiSuggestion}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md text-xs">
                    {row.aiSuggestion}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge variant={rankVariant(row.suggestionRank)}>{row.suggestionRank}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={row.agentUsed ? "default" : "destructive"}>
                  {row.agentUsed ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">
                <span className="line-clamp-2">{row.agentResponse || "-"}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

