"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { AgentSidebar } from "@/components/agent/AgentSidebar";

const db = getFirestore();

export default function AgentLayout({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "agent") {
      router.push("/login");
      return;
    }

    const ref = doc(db, "agentPresence", user.uid);

    const now = new Date();
    setDoc(
      ref,
      {
        status: "available",
        callId: null,
        incomingCall: null,
        updatedAt: now.toISOString(),
      },
      { merge: true }
    ).catch((e) => console.error("presence set failed", e));

    return () => {
      setDoc(
        ref,
        {
          status: "offline",
          callId: null,
          incomingCall: null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((e) => console.error("presence cleanup failed", e));
    };
  }, [user, role, loading, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#060a14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
          <p className="text-xs text-slate-500 animate-pulse">Loading Aura…</p>
        </div>
      </div>
    );
  }

  if (!user || role !== "agent") return null;

  return (
    <div className="h-screen flex bg-[#060a14] text-foreground overflow-hidden">
      <AgentSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
