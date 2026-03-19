"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Phone, Clock, Star, Edit, Save, X, LogOut } from "lucide-react";
import { getAuth, signOut } from "firebase/auth";

interface Stats {
  callsToday: number;
  avgAHT: number;
  avgCSAT: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    // Use Firebase Auth data directly for profile info
    setDisplayName(user.displayName || user.email?.split("@")[0] || "Agent");
    setEditName(user.displayName || user.email?.split("@")[0] || "Agent");

    const fetchStats = async () => {
      try {
        const statsRes = await fetch("/api/agent/stats");
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error("Could not load stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleSaveName = async () => {
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      if (res.ok) {
        setDisplayName(editName);
        setEditing(false);
        toast({ title: "✓ Name updated" });
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update name.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not update name.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(getAuth());
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white/90">Profile</h1>

      {/* Profile Info */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader>
          <CardTitle className="text-white/80">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-slate-400">Name</Label>
            {editing ? (
              <div className="flex space-x-2 mt-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setEditName(displayName);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-1">
                <span className="text-white/90">
                  {loading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    displayName
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  className="text-slate-400 hover:text-white"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label className="text-slate-400">Email</Label>
            <p className="text-white/90 mt-1">
              {loading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                user?.email || "—"
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Calls Today
            </CardTitle>
            <Phone className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-white/90">
                {stats?.callsToday || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Average AHT
            </CardTitle>
            <Clock className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-white/90">
                {stats?.avgAHT
                  ? `${Math.round(stats.avgAHT / 60)}m ${stats.avgAHT % 60}s`
                  : "N/A"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Average CSAT
            </CardTitle>
            <Star className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-white/90">
                {stats?.avgCSAT ? `${stats.avgCSAT}/5` : "N/A"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sign Out */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="w-full bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}