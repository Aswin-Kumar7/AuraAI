"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/company/Sidebar";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Backward-compat: older data used "company_admin". Treat it as "admin" for access.
      if (role !== "admin" && role !== "company_admin") {
        router.push("/agent/dashboard");
      }
    }
  }, [role, loading, router]);

  if (loading) return null;
  if (role !== "admin" && role !== "company_admin") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full lg:ml-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
