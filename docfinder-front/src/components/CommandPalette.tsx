"use client";

import Link from "next/link";
import { Bot, Command, FileSearch, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DOCUMENTS } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuerySelect: (query: string) => void;
  onOpenUpload: () => void;
  onModeChange: (mode: "search" | "ask") => void;
}

export function CommandPalette({ open, onOpenChange, onQuerySelect, onOpenUpload, onModeChange }: Props) {
  const [command, setCommand] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const docs = useMemo(() => {
    const term = command.trim().toLowerCase();
    if (!term) return DOCUMENTS.slice(0, 6);
    return DOCUMENTS.filter((doc) => `${doc.title} ${doc.doc_type} ${doc.category} ${doc.tags.join(" ")}`.toLowerCase().includes(term)).slice(0, 6);
  }, [command]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b p-4"><DialogTitle className="flex items-center gap-2 text-base"><Command className="h-4 w-4" />Command palette</DialogTitle></DialogHeader>

        <div className="space-y-4 p-4">
          <Input autoFocus value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Quick actions and docs..." className="h-11" />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Actions</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]" onClick={() => { onModeChange("search"); onOpenChange(false); }}><FileSearch className="h-4 w-4" />Switch Search</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]" onClick={() => { onModeChange("ask"); onOpenChange(false); }}><Bot className="h-4 w-4" />Switch Ask</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]" onClick={() => { onOpenChange(false); onOpenUpload(); }}><UploadCloud className="h-4 w-4" />Open Upload</button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Documents</p>
            <div className="grid gap-2">
              {docs.map((doc) => (
                <div key={doc.doc_id} className="rounded-xl border px-3 py-2 hover:bg-[hsl(var(--muted))]/50">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="truncate text-left text-sm font-semibold hover:text-[hsl(var(--primary))]"
                      onClick={() => {
                        onQuerySelect(doc.title);
                        onOpenChange(false);
                      }}
                    >
                      {doc.title}
                    </button>
                    <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">{doc.doc_type}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{doc.doc_id}</span>
                    <Link href={`/documents/${doc.doc_id}`} onClick={() => onOpenChange(false)} className="hover:text-[hsl(var(--foreground))]">Open detail</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
