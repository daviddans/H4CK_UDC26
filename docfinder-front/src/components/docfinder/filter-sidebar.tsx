"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
  RotateCcw,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";

import type { SearchApiResponse, SearchFilters, SortMode } from "@/types/docfinder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type FilterSidebarProps = {
  filters: SearchFilters;
  available: SearchApiResponse["available"];
  onUpdate: (next: SearchFilters) => void;
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function parseDateValue(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
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

function DatePicker({
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  minDate?: Date;
  maxDate?: Date;
}) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState<Date>(selectedDate ?? new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const min = minDate ? startOfDay(minDate) : undefined;
  const max = maxDate ? startOfDay(maxDate) : undefined;

  const isDayDisabled = (day: Date) => {
    if (min && isBefore(day, min)) {
      return true;
    }
    if (max && isAfter(day, max)) {
      return true;
    }
    return false;
  };

  const selectDay = (day: Date) => {
    if (isDayDisabled(day)) {
      return;
    }
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  const selectToday = () => {
    const today = startOfDay(new Date());
    if (isDayDisabled(today)) {
      return;
    }
    onChange(format(today, "yyyy-MM-dd"));
    setMonthCursor(today);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group relative flex h-9 w-full items-center rounded-2xl border border-slate-200 bg-white pl-8 pr-8 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:ring-cyan-500/30"
        >
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition group-hover:text-cyan-500 dark:text-slate-300 dark:group-hover:text-cyan-300" />
          <span className="truncate">
            {selectedDate ? format(selectedDate, "dd MMM yyyy") : placeholder}
          </span>
          {selectedDate ? (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              role="button"
              aria-label={`Clear ${placeholder}`}
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[292px] p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthCursor((prev) => addMonths(prev, -1))}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {format(monthCursor, "MMMM yyyy")}
          </p>

          <button
            type="button"
            onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((day, index) => (
            <span
              key={`${day}-${index}`}
              className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-300"
            >
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const outside = !isSameMonth(day, monthCursor);
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;
            const disabled = isDayDisabled(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(day)}
                className={cn(
                  "h-8 rounded-lg text-xs font-medium transition",
                  outside
                    ? "text-slate-300 dark:text-slate-600"
                    : "text-slate-700 dark:text-slate-100",
                  selected &&
                    "bg-cyan-600 text-white shadow-[0_8px_16px_rgba(8,145,178,0.35)] dark:bg-cyan-500 dark:text-slate-950",
                  !selected && !disabled && "hover:bg-slate-100 dark:hover:bg-slate-800",
                  isToday(day) && !selected && "ring-1 ring-cyan-400/60",
                  disabled && "cursor-not-allowed opacity-45"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <Button size="sm" variant="ghost" onClick={() => onChange("")}>Clear</Button>
          <Button size="sm" variant="secondary" onClick={selectToday}>Today</Button>
        </div>
      </PopoverContent>
    </Popover>
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
  const fromDate = parseDateValue(filters.from);
  const toDate = parseDateValue(filters.to);

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

            <FieldBlock label="From" className="w-[182px]">
              <DatePicker
                value={filters.from || ""}
                onChange={(next) =>
                  onUpdate({
                    ...filters,
                    from: next,
                    to: filters.to && next && filters.to < next ? next : filters.to,
                  })
                }
                placeholder="From date"
                maxDate={toDate ?? undefined}
              />
            </FieldBlock>

            <FieldBlock label="To" className="w-[182px]">
              <DatePicker
                value={filters.to || ""}
                onChange={(next) => onUpdate({ ...filters, to: next })}
                placeholder="To date"
                minDate={fromDate ?? undefined}
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
