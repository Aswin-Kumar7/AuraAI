"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeprecatedOutboundPage() {
  const router = useRouter();
  
  useEffect(() => {
    // The WebRTC Voice Dialer is now embedded as a modal safely inside the Dashboard Hero App
    // to prevent call drops during SPA route navigation!
    router.replace("/agent/dashboard");
  }, [router]);

  return (
    <div className="h-full flex items-center justify-center p-6 text-slate-500">
      Redirecting to the Dashboard WebDialer...
    </div>
  );
}