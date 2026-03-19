"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { KBEditor } from "@/components/company/KBEditor";
import { Loader2, Play } from "lucide-react";

type Language = "en" | "hi" | "hinglish" | "auto";

interface CompanyConfig {
  companyName: string;
  voiceId: string;
  knowledgeBase: string;
  complianceKeywords: string[];
  alertThreshold: number;
  language: Language;
}

const defaultConfig: CompanyConfig = {
  companyName: "",
  voiceId: "",
  knowledgeBase: "",
  complianceKeywords: [],
  alertThreshold: 50,
  language: "en",
};

function useDebouncedSaver(config: CompanyConfig, onSave: (partial: Partial<CompanyConfig>) => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!config) return;
    setSaving(true);
    const id = setTimeout(async () => {
      await onSave(config);
      setSaving(false);
      setSavedAt(new Date());
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return {
    saving,
    savedAt,
  };
}

export default function SetupPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CompanyConfig>(defaultConfig);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/company/config");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load config");
        }
        const data = await res.json();
        setConfig({ ...defaultConfig, ...data });
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const debounced = useDebouncedSaver(config, async (partial) => {
    try {
      const res = await fetch("/api/company/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save config");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  });

  const alertLabel = useMemo(() => {
    if (config.alertThreshold < 30) return "Aggressive";
    if (config.alertThreshold <= 60) return "Balanced";
    return "Conservative";
  }, [config.alertThreshold]);

  const handleVoicePreview = async () => {
    if (!config.voiceId) return;
    try {
      setPreviewLoading(true);
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: config.voiceId,
          text: "Hi, this is your Aura AI agent. This is a voice preview.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to preview voice");
      }
      const audio = new Audio(data.audio);
      audio.play();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAddKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (config.complianceKeywords.includes(value)) {
      setKeywordInput("");
      return;
    }
    setConfig((c) => ({ ...c, complianceKeywords: [...c.complianceKeywords, value] }));
    setKeywordInput("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setConfig((c) => ({ ...c, complianceKeywords: c.complianceKeywords.filter((k) => k !== kw) }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Configuration</h2>
          <p className="text-muted-foreground">
            Control the voice, knowledge, compliance and language settings that power Aura.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {debounced.saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          ) : debounced.savedAt ? (
            "Saved ✓"
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Voice Config */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Voice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Deepgram Voice ID</label>
                <Input
                  value={config.voiceId}
                  onChange={(e) => setConfig({ ...config, voiceId: e.target.value })}
                  placeholder="deepgram-voice-id (optional)"
                  className="max-w-md"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVoicePreview}
                disabled={!config.voiceId || previewLoading}
              >
                {previewLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Previewing...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Preview Voice
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Section 2: Knowledge Base */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent>
              {config.knowledgeBase ? null : (
                <p className="text-xs text-muted-foreground mb-2">
                  No knowledge base uploaded.
                </p>
              )}
              <KBEditor
                value={config.knowledgeBase}
                onChange={(v) => setConfig({ ...config, knowledgeBase: v })}
                onSave={async () => {
                  toast({ title: "KB indexed", description: "Knowledge base ingested into Pinecone." });
                }}
              />
            </CardContent>
          </Card>

          {/* Section 3: Compliance Keywords */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Compliance Keywords</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Add phrases that should trigger alerts, like &quot;cancel&quot;, &quot;refund&quot; or
                &quot;legal&quot;.
              </p>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Type keyword and press Enter"
                  className="max-w-md"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddKeyword}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.complianceKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    {kw}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveKeyword(kw)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {config.complianceKeywords.length === 0 && (
                  <span className="text-xs text-muted-foreground">No keywords yet.</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Alert Sensitivity */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Alert Sensitivity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Control how aggressively Aura flags compliance events.
              </p>
              <div className="space-y-2 max-w-md">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[config.alertThreshold]}
                  onValueChange={(values) => {
                    const next = Array.isArray(values) && values.length > 0 ? values[0] : config.alertThreshold;
                    setConfig({ ...config, alertThreshold: next });
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{config.alertThreshold}</span>
                  <span>{alertLabel}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Language */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Language</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Choose how Aura understands and responds during calls.
              </p>
              <div className="max-w-xs">
                <Select
                  value={config.language}
                  onValueChange={(v) => setConfig({ ...config, language: v as Language })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="hinglish">Hinglish</SelectItem>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

