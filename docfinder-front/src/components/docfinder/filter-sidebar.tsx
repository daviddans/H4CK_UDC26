"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Languages,
  RotateCcw,
  SlidersHorizontal,
  Tags,
} from "lucide-react";

import type { SearchApiResponse, SearchFilters, SortMode } from "@/types/docfinder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterSidebarProps = {
  filters: SearchFilters;
  available: SearchApiResponse["available"];
  onUpdate: (next: SearchFilters) => void;
};

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function FieldBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-[120px] space-y-1", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
        {label}
      </p>
      {children}
    </div>
  );
}

function MiniSelect({
  placeholder,
  options,
  onPick,
  disabled,
}: {
  placeholder: string;
  options: string[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      defaultValue=""
      disabled={disabled}
      onChange={(event) => {
        const value = event.target.value;
        if (value) {
          onPick(value);
        }
        event.currentTarget.value = "";
      }}
      className={cn(
        "h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/40"
      )}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-300" />
      <Input
        type="date"
        value={value}
        className="h-9 rounded-xl border-slate-200 bg-white pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function FilterSidebar({ filters, available, onUpdate }: FilterSidebarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeCount = useMemo(
    () =>
      filters.doc_type.length +
      filters.tags.length +
      filters.lang.length +
      (filters.from ? 1 : 0) +
      (filters.to ? 1 : 0),
    [filters]
  );

  const quickTypeOptions = available.docTypes.slice(0, 20);
  const quickLangOptions = available.langs.slice(0, 20);
  const quickTagOptions = available.tags.slice(0, 24);

  return (
    <Card className="rounded-2xl border-slate-200/90 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
            <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            Filters
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {activeCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setAdvancedOpen((prev) => !prev)}
            >
              Advanced
              <ChevronDown className={cn("h-3.5 w-3.5 transition", advancedOpen && "rotate-180")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() =>
                onUpdate({
                  doc_type: [],
                  tags: [],
                  lang: [],
                  from: "",
                  to: "",
                  sort: "relevance_desc",
                })
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <FieldBlock label="Type" className="w-[170px] flex-1">
              <MiniSelect
                placeholder={quickTypeOptions.length ? "Add type" : "No type options"}
                options={quickTypeOptions}
                disabled={!quickTypeOptions.length}
                onPick={(value) => onUpdate({ ...filters, doc_type: toggleValue(filters.doc_type, value) })}
              />
            </FieldBlock>

            <FieldBlock label="Language" className="w-[160px] flex-1">
              <MiniSelect
                placeholder={quickLangOptions.length ? "Add language" : "No language options"}
                options={quickLangOptions}
                disabled={!quickLangOptions.length}
                onPick={(value) => onUpdate({ ...filters, lang: toggleValue(filters.lang, value) })}
              />
            </FieldBlock>

            <FieldBlock label="From" className="w-[170px]">
              <DateInput
                value={filters.from || ""}
                onChange={(value) => onUpdate({ ...filters, from: value })}
              />
            </FieldBlock>

            <FieldBlock label="To" className="w-[170px]">
              <DateInput
                value={filters.to || ""}
                onChange={(value) => onUpdate({ ...filters, to: value })}
              />
            </FieldBlock>
          </div>

          <div className="hidden h-9 w-px bg-slate-200 dark:bg-slate-700 md:block" />

          <FieldBlock label="Sort" className="w-full md:w-[240px]">
            <Select
              value={filters.sort}
              onValueChange={(value: SortMode) => onUpdate({ ...filters, sort: value })}
            >
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance_desc">Relevance: High to low</SelectItem>
                <SelectItem value="relevance_asc">Relevance: Low to high</SelectItem>
                <SelectItem value="date_desc">Date: Newest first</SelectItem>
                <SelectItem value="date_asc">Date: Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </FieldBlock>
        </div>

        {(filters.doc_type.length > 0 || filters.lang.length > 0 || filters.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {filters.doc_type.map((item) => (
              <button
                key={`type-${item}`}
                type="button"
                onClick={() =>
                  onUpdate({
                    ...filters,
                    doc_type: filters.doc_type.filter((value) => value !== item),
                  })
                }
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {item} x
              </button>
            ))}
            {filters.lang.map((item) => (
              <button
                key={`lang-${item}`}
                type="button"
                onClick={() =>
                  onUpdate({
                    ...filters,
                    lang: filters.lang.filter((value) => value !== item),
                  })
                }
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Languages className="mr-1 inline-flex h-3 w-3" />
                {item} x
              </button>
            ))}
            {filters.tags.map((item) => (
              <button
                key={`tag-${item}`}
                type="button"
                onClick={() =>
                  onUpdate({
                    ...filters,
                    tags: filters.tags.filter((value) => value !== item),
                  })
                }
                className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/25"
              >
                <Tags className="mr-1 inline-flex h-3 w-3" />
                {item} x
              </button>
            ))}
          </div>
        )}

        {advancedOpen && (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/75 p-2.5 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-200">
              <CalendarDays className="h-3.5 w-3.5" />
              Tags
            </div>

            {quickTagOptions.length ? (
              <div className="flex flex-wrap gap-1.5">
                {quickTagOptions.map((option) => {
                  const active = filters.tags.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onUpdate({ ...filters, tags: toggleValue(filters.tags, option) })}
                      className={cn(
                        "rounded-full border px-2 py-1 text-[11px] capitalize transition",
                        active
                          ? "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-400/60 dark:bg-cyan-500/15 dark:text-cyan-200"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Run a search to load tag options.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
