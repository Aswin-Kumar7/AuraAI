"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface KBEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
  maxLength?: number;
}

const DEFAULT_MAX = 50000;

export function KBEditor({ value, onChange, onSave, maxLength = DEFAULT_MAX }: KBEditorProps) {
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setProgress("Indexing...");
      const res = await fetch("/api/kb/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kbText: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to index knowledge base");
      }
      setProgress(`Indexing complete. ${data.chunksIndexed ?? 0} chunks indexed.`);
      await onSave(value);
    } catch (e: any) {
      setProgress(e.message || "Indexing failed");
    } finally {
      setSaving(false);
    }
  };

  const length = value.length;

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-64 w-full resize-y"
        maxLength={maxLength}
        placeholder="Paste FAQs, SOPs, product docs... up to 50,000 characters."
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {length}/{maxLength} characters
        </span>
        {progress && <span>{progress}</span>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={saving || length === 0}
          onClick={handleSave}
        >
          {saving ? "Indexing..." : "Save & Re-index"}
        </Button>
      </div>
    </div>
  );
}

