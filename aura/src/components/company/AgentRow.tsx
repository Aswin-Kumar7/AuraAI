import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

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

function roleLabel(role: AgentRowProps["role"]) {
  return role === "admin" ? "Admin" : "Agent";
}

function statusDotClass(status: AgentRowProps["status"]) {
  if (status === "online") return "bg-green-500";
  if (status === "on-call") return "bg-yellow-500";
  return "bg-gray-400";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

export default function AgentRow({
  email,
  name,
  role,
  status,
  callsHandled,
  addedAt,
  onRemove,
  onRoleChange,
  disabled,
}: AgentRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{email}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{name || "--"}</TableCell>
      <TableCell>
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {roleLabel(role)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
          <span className="text-sm capitalize text-muted-foreground">{status}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm">{callsHandled}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDate(addedAt)}</TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-2">
          <Select
            value={role}
            onValueChange={(v) => onRoleChange(email, v as AgentRowProps["role"])}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-[160px] bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(email)}
            disabled={disabled}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
