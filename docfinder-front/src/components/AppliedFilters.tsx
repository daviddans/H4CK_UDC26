"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UiFilters } from "@/lib/types";

interface Props {
  filters: UiFilters;
  query: string;
  onRemove: (type: "doc_type" | "category" | "tags", value: string) => void;
  onClearField: (field: "query" | "date_from" | "date_to" | "lang") => void;
  onClearAll: () => void;
}

export function AppliedFilters({ filters, query, onRemove, onClearField, onClearAll }: Props) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];

  if (query) chips.push({ key: `q-${query}`, label: `Query: ${query}`, remove: () => onClearField("query") });
  filters.doc_type.forEach((v) => chips.push({ key: `type-${v}`, label: v, remove: () => onRemove("doc_type", v) }));
  filters.category.forEach((v) => chips.push({ key: `cat-${v}`, label: v, remove: () => onRemove("category", v) }));
  filters.tags.forEach((v) => chips.push({ key: `tag-${v}`, label: `#${v}`, remove: () => onRemove("tags", v) }));
  if (filters.lang !== "all") chips.push({ key: `lang-${filters.lang}`, label: filters.lang.toUpperCase(), remove: () => onClearField("lang") });
  if (filters.date_from) chips.push({ key: `from-${filters.date_from}`, label: `From ${filters.date_from}`, remove: () => onClearField("date_from") });
  if (filters.date_to) chips.push({ key: `to-${filters.date_to}`, label: `To ${filters.date_to}`, remove: () => onClearField("date_to") });

  if (!chips.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="inline-flex items-center gap-1 rounded-full border bg-[hsl(var(--background))] px-3 py-1 text-xs font-medium hover:bg-[hsl(var(--muted))]"
        >
          {chip.label}
          <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
