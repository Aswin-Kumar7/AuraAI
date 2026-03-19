"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasRevealEffect } from "@/components/sign-in-flow-1";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithGoogle } from "@/lib/firebase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = await signInWithGoogle();
      
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }
      
      if (data.role === "admin") {
        window.location.href = "/company/dashboard";
      } else {
        window.location.href = "/agent/dashboard";
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex w-full flex-col min-h-screen bg-black relative")} suppressHydrationWarning>
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0">
          <CanvasRevealEffect
            animationSpeed={3}
            containerClassName="bg-black"
            colors={[[255, 255, 255], [255, 255, 255]]}
            dotSize={6}
            reverse={false}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>
      
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex flex-1 flex-col justify-center items-center">
          <div className="w-full max-w-sm">
            <AnimatePresence mode="wait">
              <motion.div 
                key="email-step"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                    Aura
                  </h1>
                  <p className="text-[1.8rem] text-white/70 font-light">
                    AI Copilot for Call Centers
                  </p>
                </div>
                
                <div className="space-y-4 pt-8">
                  <button 
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="backdrop-blur-[2px] w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full py-4 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-lg font-bold">G</span>
                    <span>{loading ? "Signing in..." : "Continue with Google"}</span>
                  </button>
                  
                  {error && (
                    <div className="text-red-500 text-sm mt-4">
                      {error}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-white/40 pt-10">
                  Aura · InFynd AIM 2026
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
