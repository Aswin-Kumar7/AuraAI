"use client";

import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/store/callStore";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface AlertBannerProps {
  forceShow?: boolean;
}

export function AlertBanner({ forceShow }: AlertBannerProps) {
  const complianceAlert = useCallStore((s) => s.complianceAlert);
  const complianceReason = useCallStore((s) => s.complianceReason);
  const sentimentLabel = useCallStore((s) => s.sentimentLabel);
  const [dismissed, setDismissed] = useState(false);

  const isFrustrated =
    sentimentLabel === "frustrated" ||
    sentimentLabel === "escalating" ||
    sentimentLabel === "tense";

  const shouldShow =
    !dismissed && (complianceAlert || isFrustrated || forceShow);

  if (!shouldShow) return null;

  const isCompliance = complianceAlert;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "rounded-xl px-3.5 py-3 text-xs flex items-start gap-2.5 border relative",
          isCompliance
            ? "bg-red-500/10 border-red-500/30 text-red-300"
            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
        )}
      >
        <div
          className={cn(
            "h-7 w-7 rounded-lg shrink-0 flex items-center justify-center",
            isCompliance
              ? "bg-red-500/20"
              : "bg-amber-500/20"
          )}
        >
          {isCompliance ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[11px] mb-0.5">
            {isCompliance ? "Compliance Risk" : "Escalation Warning"}
          </p>
          <p className="text-[11px] opacity-80 leading-relaxed">
            {isCompliance
              ? complianceReason || "Compliance-sensitive topic detected. Follow company policy."
              : "Caller frustration rising. Slow down and acknowledge their concern."}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="h-3 w-3 opacity-50" />
        </button>

        {/* Pulsing border effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl border-2 animate-pulse pointer-events-none",
            isCompliance ? "border-red-500/20" : "border-amber-500/20"
          )}
        />
      </motion.div>
    </AnimatePresence>
  );
}
