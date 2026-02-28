"use client";

import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, DOC_TYPES, LANGUAGES, TAGS } from "@/lib/mock-data";
import { UiFilters } from "@/lib/types";

interface Props {
  filters: UiFilters;
  onChange: (value: UiFilters) => void;
}

const toggleValue = (values: string[], value: string) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

export function FilterSidebar({ filters, onChange }: Props) {
  const reset = () =>
    onChange({
      doc_type: [],
      category: [],
      tags: [],
      date_from: undefined,
      date_to: undefined,
      lang: "all",
      order: "relevance",
    });

  return (
    <Card className="sticky top-[96px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Doc type</Label>
          <div className="grid gap-2">
            {DOC_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.doc_type.includes(type)} onCheckedChange={() => onChange({ ...filters, doc_type: toggleValue(filters.doc_type, type) })} />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <div className="grid gap-2">
            {CATEGORIES.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.category.includes(item)} onCheckedChange={() => onChange({ ...filters, category: toggleValue(filters.category, item) })} />
                {item}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="grid grid-cols-2 gap-2">
            {TAGS.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm">
                <Checkbox checked={filters.tags.includes(tag)} onCheckedChange={() => onChange({ ...filters, tags: toggleValue(filters.tags, tag) })} />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date range</Label>
          <Input type="date" value={filters.date_from ?? ""} onChange={(event) => onChange({ ...filters, date_from: event.target.value || undefined })} />
          <Input type="date" value={filters.date_to ?? ""} onChange={(event) => onChange({ ...filters, date_to: event.target.value || undefined })} />
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={filters.lang} onValueChange={(value) => onChange({ ...filters, lang: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Order</Label>
          <Select value={filters.order} onValueChange={(value: "relevance" | "date") => onChange({ ...filters, order: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
