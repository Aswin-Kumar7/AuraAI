"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Phone, History, BookUser, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { motion } from "framer-motion";

interface ContactData {
  name: string;
  phone: string;
  callCount: number;
  lastCallAt: string;
  lastIssue: string;
  summaries: string[];
}

const CONTACT_AVATAR_COLORS = ["bg-indigo-600", "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

function getContactAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CONTACT_AVATAR_COLORS[Math.abs(hash) % CONTACT_AVATAR_COLORS.length];
}

function getContactInitials(name: string, phone: string): string {
  if (name && name !== "Unknown" && name.trim().length > 0) {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2);
}

function toRelativeDate(dateStr: string): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function FrequencyBadge({ count }: { count: number }) {
  if (count >= 3) return <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide">Frequent</span>;
  if (count === 0) return <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">New</span>;
  return null;
}

function IssueSentimentDot({ issue }: { issue: string }) {
  const lower = (issue || "").toLowerCase();
  const isHighRisk = /refund|angry|billing|escalat|urgent|cancel|fraud|complaint/.test(lower);
  const isMedium = /issue|problem|error|fail|broken|not work/.test(lower);
  if (isHighRisk) return <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />;
  if (isMedium) return <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />;
  return <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />;
}

export default function PhonebookPage() {
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<ContactData | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [editName, setEditName] = useState("");

  const router = useRouter();

  useEffect(() => {
    fetch("/api/agent/contacts")
      .then(res => res.json())
      .then(data => {
        setContacts(data.contacts || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.phone.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.lastIssue || "").toLowerCase().includes(q)
    );
  }, [search, contacts]);

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const normalizedPhone = newContactPhone.trim();

    if (contacts.some((c) => c.phone === normalizedPhone)) {
      alert("Contact with this phone number already exists.");
      return;
    }

    const newContact: ContactData = {
      name: newContactName.trim(),
      phone: normalizedPhone,
      callCount: 0,
      lastCallAt: "",
      lastIssue: "",
      summaries: [],
    };

    setContacts((prev) => [newContact, ...prev]);
    setNewContactName("");
    setNewContactPhone("");
    setShowAddContact(false);

    try {
      await fetch("/api/agent/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: newContact }),
      });
    } catch (err) {
      console.warn("Could not persist new contact:", err);
    }
  };

  const handleUpdateCustomerName = (phone: string, newName: string) => {
    if (!newName.trim()) return;

    setContacts((prev) =>
      prev.map((c) =>
        c.phone === phone
          ? { ...c, name: newName.trim() }
          : c
      )
    );

    if (selectedContact?.phone === phone) {
      setSelectedContact({ ...selectedContact, name: newName.trim() });
    }

    // Optional: persist with PATCH endpoint if implemented
    fetch(`/api/agent/contacts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name: newName.trim() }),
    }).catch((err) => console.warn("Could not persist contact name update:", err));
  };

  const handleCall = (phone: string) => {
    router.push(`/agent/dashboard?dial=${phone.replace(/\D/g, "")}`);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookUser className="h-5 w-5 text-indigo-500" />
            Phonebook CRM
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Browse caller profiles, history, and initiate calls instantly.</p>
        </div>
        <Button
          onClick={() => setShowAddContact(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 gap-2"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
        <Input
          placeholder="Search by name, number, or issue..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none bg-transparent text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 px-0 h-8"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 hover:bg-transparent bg-slate-50">
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Contact</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Phone Number</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider text-center">Interactions</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Last Call</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider">Last Issue</TableHead>
              <TableHead className="text-slate-500 font-semibold h-11 text-xs uppercase tracking-wider text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100">
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-xl bg-slate-200" /><Skeleton className="h-4 w-32 bg-slate-200" /></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-slate-200" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-slate-200" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 bg-slate-200" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg bg-slate-200" /></TableCell>
                </TableRow>
              ))
            ) : filteredContacts.length === 0 ? (
              <TableRow className="border-b-transparent hover:bg-transparent">
                <TableCell colSpan={6} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <BookUser className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm">No contacts found</p>
                    <p className="text-slate-400 text-xs">Have some inbound/outbound calls first to populate this CRM.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((c, idx) => (
                <motion.tr
                  key={c.phone}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => { setSelectedContact(c); setEditName(c.name); }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0", getContactAvatarColor(c.phone))}>
                        {getContactInitials(c.name, c.phone)}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <span className="font-semibold text-slate-900 text-sm">{c.name}</span>
                        <FrequencyBadge count={c.callCount} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-xs">{c.phone}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{c.callCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-500 text-xs" title={c.lastCallAt ? new Date(c.lastCallAt).toLocaleString() : ""}>
                      {toRelativeDate(c.lastCallAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 max-w-[200px]">
                      <IssueSentimentDot issue={c.lastIssue} />
                      <span className="text-slate-500 text-xs truncate">{c.lastIssue || "None recorded"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleCall(c.phone); }}
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-100 transition-all"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1" /> Call
                    </Button>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Contact Sheet */}
      <Sheet open={showAddContact} onOpenChange={(v) => !v && setShowAddContact(false)}>
        <SheetContent className="bg-white border-slate-200 sm:max-w-md p-6 overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl text-slate-900">Add New Contact</SheetTitle>
            <p className="text-sm text-slate-500">Enter phone and customer name to add to phonebook.</p>
          </SheetHeader>
          <div className="space-y-4">
            <Input
              placeholder="Customer Name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="bg-slate-50 border-slate-200 text-slate-900"
            />
            <Input
              placeholder="Phone Number"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="bg-slate-50 border-slate-200 text-slate-900"
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddContact} className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1">
                Save Contact
              </Button>
              <Button onClick={() => setShowAddContact(false)} variant="outline" className="border-slate-200 text-slate-700 flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={(v) => !v && setSelectedContact(null)}>
        {selectedContact && (
          <SheetContent className="bg-white border-slate-200 sm:max-w-md p-6 overflow-y-auto">
            <SheetHeader className="mb-5">
              <div className="flex justify-center mb-4">
                <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-md", getContactAvatarColor(selectedContact.phone))}>
                  {getContactInitials(selectedContact.name, selectedContact.phone)}
                </div>
              </div>
              <SheetTitle className="text-center text-slate-900 text-xl">{selectedContact.name}</SheetTitle>
              <div className="text-center font-mono text-slate-400 text-sm">{selectedContact.phone}</div>
              <div className="mt-4 space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-slate-900"
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdateCustomerName(selectedContact.phone, editName)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Update Name
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-slate-900">{selectedContact.callCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Total Calls</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <IssueSentimentDot issue={selectedContact.lastIssue} />
                  </div>
                  <div className="text-xs font-medium text-slate-700 line-clamp-2 leading-tight">{selectedContact.lastIssue || "N/A"}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Latest Issue</div>
                </div>
              </div>

              <Button
                onClick={() => handleCall(selectedContact.phone)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                <Phone className="h-4 w-4 mr-2" /> Start Call Now
              </Button>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Past Call Summaries
                </h3>
                {selectedContact.summaries && selectedContact.summaries.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContact.summaries.map((summary, idx) => (
                      <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 rounded-l-xl" />
                        <span className="absolute top-3 right-3 text-[10px] font-bold text-slate-300">#{idx + 1}</span>
                        {summary}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 p-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
                    No AI summaries yet for this contact.
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
