"use client";

import { CalendarRange, Languages, Tags, SlidersHorizontal } from "lucide-react";

import type { SearchFilters, SearchApiResponse } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function FilterGroup({
  title,
  icon,
  options,
  values,
  onToggle,
}: {
  title: string;
  icon?: React.ReactNode;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition",
                active
                  ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterSidebar({ filters, available, onUpdate }: FilterSidebarProps) {
  return (
    <Card className="sticky top-24 rounded-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            Filters
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onUpdate({
                doc_type: [],
                category: [],
                tags: [],
                lang: [],
                from: "",
                to: "",
                sort: "relevance",
              })
            }
          >
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <FilterGroup
          title="Doc type"
          options={available.docTypes}
          values={filters.doc_type}
          onToggle={(value) =>
            onUpdate({ ...filters, doc_type: toggleValue(filters.doc_type, value) })
          }
        />

        <FilterGroup
          title="Category"
          options={available.categories}
          values={filters.category}
          onToggle={(value) =>
            onUpdate({ ...filters, category: toggleValue(filters.category, value) })
          }
        />

        <FilterGroup
          title="Tags"
          icon={<Tags className="h-4 w-4 text-slate-400" />}
          options={available.tags}
          values={filters.tags}
          onToggle={(value) =>
            onUpdate({ ...filters, tags: toggleValue(filters.tags, value) })
          }
        />

        <FilterGroup
          title="Language"
          icon={<Languages className="h-4 w-4 text-slate-400" />}
          options={available.langs}
          values={filters.lang}
          onToggle={(value) =>
            onUpdate({ ...filters, lang: toggleValue(filters.lang, value) })
          }
        />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            Date range
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Input
              type="date"
              value={filters.from || ""}
              onChange={(event) => onUpdate({ ...filters, from: event.target.value })}
            />
            <Input
              type="date"
              value={filters.to || ""}
              onChange={(event) => onUpdate({ ...filters, to: event.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Order by</p>
          <Select
            value={filters.sort}
            onValueChange={(value: "relevance" | "date") =>
              onUpdate({ ...filters, sort: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort results" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="accent">Multi-select</Badge>
          <Badge variant="outline">Sticky sidebar</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
