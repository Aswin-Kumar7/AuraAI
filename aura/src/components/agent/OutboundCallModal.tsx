"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Loader2, Sparkles } from "lucide-react";

const COUNTRY_OPTIONS = [
  { value: "+91", label: "🇮🇳 +91" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+61", label: "🇦🇺 +61" },
  { value: "+971", label: "🇦🇪 +971" },
];

const COUNTRY_CODES_DESC = COUNTRY_OPTIONS.map((c) => c.value).sort(
  (a, b) => b.length - a.length
);

interface OutboundCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCall: (params: { customerPhone: string; twilioCallerId: string; context?: string }) => void;
  isDialerReady: boolean;
}

export function OutboundCallModal({ isOpen, onClose, onCall, isDialerReady }: OutboundCallModalProps) {
  const [toPhone, setToPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [fromPhone, setFromPhone] = useState("");
  const [context, setContext] = useState("");
  const [loadingIds, setLoadingIds] = useState(false);
  const [callerIds, setCallerIds] = useState<{ phone: string; name: string; type?: string }[]>([]);
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([]);
  const [suggestions, setSuggestions] = useState<{ name: string; phone: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const parsePhoneParts = (value: string, fallbackCountryCode: string) => {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");

    if (!digits) {
      return { nextCountryCode: fallbackCountryCode, nextToPhone: "" };
    }

    if (raw.startsWith("+")) {
      const normalized = raw.replace(/[^\d+]/g, "");
      const matchedCode = COUNTRY_CODES_DESC.find((code) =>
        normalized.startsWith(code)
      );

      if (matchedCode) {
        const localDigits = normalized
          .slice(matchedCode.length)
          .replace(/\D/g, "");
        return { nextCountryCode: matchedCode, nextToPhone: localDigits };
      }

      return { nextCountryCode: fallbackCountryCode, nextToPhone: digits };
    }

    const fallbackDigits = fallbackCountryCode.replace("+", "");
    if (digits.startsWith(fallbackDigits) && digits.length > fallbackDigits.length) {
      return {
        nextCountryCode: fallbackCountryCode,
        nextToPhone: digits.slice(fallbackDigits.length),
      };
    }

    return { nextCountryCode: fallbackCountryCode, nextToPhone: digits };
  };

  useEffect(() => {
    if (isOpen) {
      if (callerIds.length === 0) {
        setLoadingIds(true);
        fetch("/api/twilio/caller-ids")
          .then((r) => r.json())
          .then((data) => {
            if (data.numbers) {
              setCallerIds(data.numbers);
              const purchased = data.numbers.filter((n: any) => n.type === "Purchased");
              if (purchased.length > 0) setFromPhone(purchased[0].phone);
              else if (data.numbers.length > 0) setFromPhone(data.numbers[0].phone);
            }
          })
          .finally(() => setLoadingIds(false));
      }

      if (contacts.length === 0) {
        fetch("/api/agent/contacts")
          .then(r => r.json())
          .then(data => {
             if (data.contacts) setContacts(data.contacts);
          });
      }
    }
  }, [isOpen]);

  const handleToPhoneChange = (val: string) => {
    const raw = val.trim();
    const parsed = parsePhoneParts(raw, countryCode);

    setCountryCode(parsed.nextCountryCode);
    setToPhone(parsed.nextToPhone);

    // Filter suggestions based on original input
    const query = raw.toLowerCase();
    if (query) {
      const filtered = contacts.filter(c => 
        c.phone.includes(query) || c.name.toLowerCase().includes(query)
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (phone: string) => {
    const parsed = parsePhoneParts(phone, countryCode);
    setCountryCode(parsed.nextCountryCode);
    setToPhone(parsed.nextToPhone);

    setShowSuggestions(false);
  };

  const handleDial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPhone || !fromPhone) return;

    // Normalize destination to E.164 Twilio format.
    const rawPhone = toPhone.replace(/\D/g, "");
    const formattedTo = `${countryCode}${rawPhone}`;

    onCall({ customerPhone: formattedTo, twilioCallerId: fromPhone, context });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-[#0a0e1a] border-white/[0.08] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <Phone className="h-5 w-5 text-indigo-400" />
            New Outbound Call
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Dial straight from your browser. Your microphone will automatically connect instantly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDial} className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label className="text-white/80 text-xs tracking-wider uppercase font-semibold">Caller ID</Label>
            <Select value={fromPhone} onValueChange={setFromPhone} disabled={loadingIds || !isDialerReady}>
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                <SelectValue placeholder={loadingIds ? "Loading..." : "Select registered number"} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {callerIds
                  .filter(c => c.type === "Purchased")
                  .map((c) => (
                    <SelectItem key={c.phone} value={c.phone}>
                      {c.phone} ({c.name})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 relative">
            <Label className="text-white/80 text-xs tracking-wider uppercase font-semibold">Customer Number</Label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger className="w-[100px] bg-white/[0.04] border-white/[0.08] text-white font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {COUNTRY_OPTIONS.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={toPhone}
                onChange={(e) => handleToPhoneChange(e.target.value)}
                onFocus={() => toPhone && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="10-digit number"
                className="flex-1 bg-white/[0.04] border-white/[0.08] text-white font-mono"
                required
              />
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-1 bg-slate-900 border border-white/[0.1] rounded-lg shadow-2xl p-1 animate-in fade-in zoom-in duration-200">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s.phone);
                    }}
                    onClick={() => selectSuggestion(s.phone)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.05] rounded-md transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-white/90">{s.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{s.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80 text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> AI Prime Context (Optional)
            </Label>
            <Input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Account upgrade attempt..."
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={!toPhone || !fromPhone || !isDialerReady}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
            >
              {!isDialerReady ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting WebRTC Engine...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2 fill-current" /> Dial {toPhone && toPhone}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
