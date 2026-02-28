"use client";

import { useEffect, useMemo } from "react";
import { FileSearch, Layers3 } from "lucide-react";

import type { DocumentHit } from "@/types/docfinder";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuery: (query: string) => void;
  hits: DocumentHit[];
};

export function CommandPalette({ open, onOpenChange, onSelectQuery, hits }: CommandPaletteProps) {
  const items = useMemo(() => {
    const seen = new Set<string>();
    const unique: Array<Pick<DocumentHit, "doc_id" | "title" | "category">> = [];
    for (const hit of hits) {
      if (seen.has(hit.doc_id)) {
        continue;
      }
      seen.add(hit.doc_id);
      unique.push({
        doc_id: hit.doc_id,
        title: hit.title,
        category: hit.category,
      });
      if (unique.length >= 14) {
        break;
      }
    }
    return unique;
  }, [hits]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Search</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search documents, categories, tags..." />
          <CommandList>
            <CommandEmpty>No suggestions found.</CommandEmpty>
            {items.length > 0 ? (
              <CommandGroup heading="Documents">
                {items.map((item) => (
                  <CommandItem
                    key={item.doc_id}
                    onSelect={() => {
                      onSelectQuery(item.title);
                      onOpenChange(false);
                    }}
                  >
                    <FileSearch className="h-4 w-4 text-slate-400" />
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      <span className="text-xs text-slate-500">{item.doc_id}</span>
                    </div>
                    <CommandShortcut>{item.category}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  onSelectQuery("policy security mfa");
                  onOpenChange(false);
                }}
              >
                <Layers3 className="h-4 w-4 text-slate-400" />
                Search: security controls
                <CommandShortcut>Preset</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
