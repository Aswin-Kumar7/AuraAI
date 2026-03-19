"use client";

import { useEffect, useState } from "react";
import AgentRow from "@/components/company/AgentRow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load agents");
      }
      setAgents(await res.json());
    } catch {
      toast({ title: "Error", description: "Failed to load agents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    // Backward-compat: older data used "company_admin". Treat it as "admin" for access.
    if (currentRole !== "admin" && currentRole !== "company_admin") {
      setLoading(false);
      return;
    }

    fetchAgents();
    const id = setInterval(fetchAgents, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentRole]);

  const handleAddAgent = async (values: z.infer<typeof addAgentSchema>) => {
    if (!companyId) {
      toast({ title: "Error", description: "Company not loaded yet.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/company/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, role: values.role, companyId }),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Agent added successfully" });
        form.reset({ email: "", role: "agent" });
        fetchAgents();
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to add agent");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (targetEmail: string) => {
    if (!confirm(`Remove access for ${targetEmail}?`)) return;

    try {
      setRowBusyEmail(targetEmail);
      const res = await fetch(`/api/company/whitelist?email=${encodeURIComponent(targetEmail)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Removed", description: "Agent access revoked." });
        setAgents((prev) => prev.filter((a) => a.email !== targetEmail));
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove agent");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRowBusyEmail(null);
    }
  };

  const handleRoleChange = async (email: string, nextRole: Agent["role"]) => {
    const prev = agents;
    setAgents((cur) => cur.map((a) => (a.email === email ? { ...a, role: nextRole } : a)));
    setRowBusyEmail(email);
    try {
      const res = await fetch("/api/company/whitelist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: nextRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update role");
      }
      toast({ title: "Updated", description: "Role updated successfully." });
    } catch (e: any) {
      setAgents(prev);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRowBusyEmail(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Agent Management</h2>
        <p className="text-muted-foreground">Manage your team and their access roles.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Add Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleAddAgent)}
              className="flex flex-col sm:flex-row gap-4 items-end"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-1 w-full">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="agent@company.com"
                        autoComplete="email"
                        className="bg-transparent"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="w-full sm:w-56">
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-transparent">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={!form.formState.isValid || form.formState.isSubmitting}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                {form.formState.isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </span>
                ) : (
                  "Add to whitelist"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="bg-white dark:bg-zinc-950 rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-lg">Active Team Members</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Calls Handled</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-muted-foreground text-sm">No agents yet — add your first agent above</p>
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
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
