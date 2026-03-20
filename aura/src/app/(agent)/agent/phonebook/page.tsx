"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Phone, History, Contact, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ContactData {
  name: string;
  phone: string;
  callCount: number;
  lastCallAt: string;
  lastIssue: string;
  summaries: string[];
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
      c.phone.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
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
    router.push(`/agent/dashboard?dial=${phone.replace(/\D/g, '')}`);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white/90 flex items-center gap-2">
            <Contact className="h-6 w-6 text-indigo-400" />
            Phonebook CRM
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse caller profiles, history, and initiate calls instantly.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.04] border-white/[0.08] text-white focus:border-indigo-500/50"
          />
        </div>
        <Button
          onClick={() => setShowAddContact(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          Add New Number
        </Button>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02] hover:bg-white/[0.02]">
            <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Customer Name</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Phone Number</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs text-center">Interactions</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Last Call Date</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs">Last Discovered Issue</TableHead>
              <TableHead className="text-slate-400 font-semibold h-11 text-xs text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell><Skeleton className="h-4 w-32 bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-white/[0.06]" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-white/[0.06]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 bg-white/[0.06]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto rounded-md bg-white/[0.06]" /></TableCell>
                </TableRow>
              ))
            ) : filteredContacts.length === 0 ? (
              <TableRow className="border-b-transparent hover:bg-transparent">
                <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                  No contacts found. Have some inbound/outbound calls first to populate this CRM.
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((c) => (
                <TableRow 
                  key={c.phone} 
                  className="border-b-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  onClick={() => {
                    setSelectedContact(c);
                    setEditName(c.name);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <UserCircle2 className="h-4 w-4 text-indigo-400" />
                       <span className="font-medium text-white/90">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-xs">{c.phone}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-white/[0.06] text-xs font-bold text-white/80">
                      {c.callCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs text-muted-foreground whitespace-nowrap">
                    {c.lastCallAt ? new Date(c.lastCallAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs break-words max-w-[200px]">
                    {c.lastIssue || "Unknown"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleCall(c.phone); }}
                      className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/30"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1" /> Call
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={showAddContact} onOpenChange={(v) => !v && setShowAddContact(false)}>
        <SheetContent className="bg-[#0a0e1a] border-white/[0.08] sm:max-w-md p-6 overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl text-white/90">Add New Contact</SheetTitle>
            <p className="text-sm text-slate-400">Enter phone and customer name to add to phonebook.</p>
          </SheetHeader>
          <div className="space-y-4">
            <Input
              placeholder="Customer Name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
            <Input
              placeholder="Phone Number"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
            <div className="flex gap-2">
              <Button onClick={handleAddContact} className="bg-indigo-500 hover:bg-indigo-600 text-white flex-1">
                Save Contact
              </Button>
              <Button onClick={() => setShowAddContact(false)} className="bg-white/[0.08] text-white/80 flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedContact} onOpenChange={(v) => !v && setSelectedContact(null)}>
        {selectedContact && (
          <SheetContent className="bg-[#0a0e1a] border-white/[0.08] sm:max-w-md p-6 overflow-y-auto">
            <SheetHeader className="mb-6">
              <div className="flex justify-center mb-4">
                <div className="h-20 w-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <UserCircle2 className="h-10 w-10 text-indigo-400" />
                </div>
              </div>
              <SheetTitle className="text-center text-white/90 text-xl">{selectedContact.name}</SheetTitle>
              <div className="text-center font-mono text-slate-400 text-sm">{selectedContact.phone}</div>
              <div className="mt-4 space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white"
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdateCustomerName(selectedContact.phone, editName)}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  Update Customer Name
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white/90">{selectedContact.callCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Total Calls</div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-3 text-center">
                  <div className="text-sm font-semibold text-white/80 line-clamp-1 break-all">
                    {selectedContact.lastIssue}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Latest Issue</div>
                </div>
              </div>

              <div>
                <Button 
                  onClick={() => handleCall(selectedContact.phone)}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
                >
                  <Phone className="h-4 w-4 mr-2" /> Start Call Now
                </Button>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Past Call Summaries
                </h3>
                {selectedContact.summaries && selectedContact.summaries.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContact.summaries.map((summary, idx) => (
                      <div key={idx} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-sm text-white/80 leading-relaxed relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/50" />
                        {summary}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 p-4 border border-dashed border-white/[0.08] rounded-lg text-center">
                    No generated AI summaries exist for this user yet.
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
