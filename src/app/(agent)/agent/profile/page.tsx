"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Phone, Clock, Star, Edit2, Save, X, LogOut, User } from "lucide-react";
import { getAuth, signOut } from "firebase/auth";
import { cn } from "@/lib/utils";

interface Stats {
  callsToday: number;
  avgAHT: number;
  avgCSAT: number;
}

interface CallerProfile {
  phone: string;
  name: string;
  callCount: number;
  profileSummary: string;
}

function toDisplayName(user: { displayName?: string | null; email?: string | null } | null): string {
  const explicit = user?.displayName?.trim();
  if (explicit) return explicit;
  const local = user?.email?.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Agent";
  return cleaned.split(" ").map((p) => p ? p[0].toUpperCase() + p.slice(1) : p).join(" ");
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["bg-indigo-600", "bg-violet-500", "bg-blue-500", "bg-emerald-500"];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [callerProfiles, setCallerProfiles] = useState<CallerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    const name = toDisplayName(user);
    setDisplayName(name);
    setEditName(name);

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

    const fetchCallerProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const contactsRes = await fetch("/api/agent/contacts");
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          const profiledContacts = (data.contacts || [])
            .filter((c: CallerProfile) => c.profileSummary && c.profileSummary.length > 0)
            .slice(0, 5);
          setCallerProfiles(profiledContacts);
        }
      } catch (error) {
        console.error("Could not load caller profiles:", error);
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchStats();
    fetchCallerProfiles();
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
        toast({ title: "Name updated" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update name.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
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

  const avatarColor = getAvatarColor(displayName || "Agent");
  const initials = displayName ? getInitials(displayName) : "AG";

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and view performance stats.</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Avatar banner */}
        <div className="bg-gradient-to-r from-indigo-50 to-slate-50 px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md shrink-0", avatarColor)}>
              {loading ? <User className="h-6 w-6 text-white/70" /> : initials}
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-6 w-40 bg-slate-200 mb-1" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-slate-900">{displayName}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Available
                  </span>
                </div>
              )}
              <p className="text-sm text-slate-400 mt-0.5">{user?.email || "—"}</p>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="p-6 space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Personal Information</p>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Display Name</Label>
              {editing ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-50 border-slate-200 text-slate-900 flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveName} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditName(displayName); }} className="border-slate-200 text-slate-600">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-900">
                    {loading ? <Skeleton className="h-4 w-32 bg-slate-200" /> : displayName}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 h-7 w-7 p-0">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1.5 block">Email Address</Label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span className="text-sm text-slate-700">{user?.email || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Calls Today", icon: Phone, iconClass: "bg-indigo-50 text-indigo-600 border-indigo-100", value: loading ? null : (stats?.callsToday ?? 0), fmt: (v: number) => String(v) },
          { label: "Average AHT", icon: Clock, iconClass: "bg-blue-50 text-blue-600 border-blue-100", value: loading ? null : (stats?.avgAHT ?? null), fmt: (v: number) => v ? `${Math.floor(v / 60)}m ${v % 60}s` : "N/A" },
          { label: "Average CSAT", icon: Star, iconClass: "bg-amber-50 text-amber-600 border-amber-100", value: loading ? null : (stats?.avgCSAT ?? null), fmt: (v: number) => v ? `${v}/5` : "N/A" },
        ].map(({ label, icon: Icon, iconClass, value, fmt }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
              <div className={cn("p-1.5 rounded-lg border", iconClass)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 bg-slate-200" />
            ) : (
              <p className="text-2xl font-bold text-slate-900">{fmt(value as number)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Caller Profiles */}
      {callerProfiles.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-slate-50 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" />
              Your Caller Insights
            </h2>
            <p className="text-xs text-slate-500 mt-1">Multi-call profiles of repeat callers you interact with</p>
          </div>
          <div className="p-6 space-y-4">
            {loadingProfiles ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 bg-slate-200 rounded-lg" />
              ))
            ) : (
              callerProfiles.map((profile, idx) => (
                <div key={profile.phone} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-900">{profile.name}</p>
                      <p className="text-xs text-emerald-700 font-mono">{profile.phone} • {profile.callCount} call{profile.callCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-900 leading-relaxed pl-11">{profile.profileSummary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:border-red-200"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

