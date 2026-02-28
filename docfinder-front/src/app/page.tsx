"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppliedFilters } from "@/components/AppliedFilters";
import { AskView } from "@/components/AskView";
import { CommandPalette } from "@/components/CommandPalette";
import { FilterSidebar } from "@/components/FilterSidebar";
import { ResultsPanel } from "@/components/ResultsPanel";
import { SearchHeader } from "@/components/SearchHeader";
import { UploadModal } from "@/components/UploadModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchResponse, UiFilters } from "@/lib/types";

const defaultFilters: UiFilters = {
  doc_type: [],
  category: [],
  tags: [],
  date_from: undefined,
  date_to: undefined,
  lang: "all",
  order: "relevance",
};

export default function HomePage() {
  const [mode, setMode] = useState<"search" | "ask">("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<UiFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters]);

  useEffect(() => {
    if (mode !== "search") return;

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);

      const params = new URLSearchParams({
        q: debouncedQuery,
        page: String(page),
        limit: "6",
        lang: filters.lang,
        order: filters.order,
      });

      if (filters.doc_type.length) params.set("doc_type", filters.doc_type.join(","));
      if (filters.category.length) params.set("category", filters.category.join(","));
      if (filters.tags.length) params.set("tags", filters.tags.join(","));
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);

      try {
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        setData((await response.json()) as SearchResponse);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setData({ hits: [], total: 0, page: 1, totalPages: 1, limit: 6, source: "mock", warning: "Search unavailable" });
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [debouncedQuery, filters, page, mode]);

  const hasActiveFilters = useMemo(
    () => Boolean(query) || filters.doc_type.length > 0 || filters.category.length > 0 || filters.tags.length > 0 || Boolean(filters.date_from) || Boolean(filters.date_to) || filters.lang !== "all",
    [filters, query]
  );

  const removeListFilter = (field: "doc_type" | "category" | "tags", value: string) => {
    setFilters((current) => ({ ...current, [field]: current[field].filter((item) => item !== value) }));
  };

  const clearField = (field: "query" | "date_from" | "date_to" | "lang") => {
    if (field === "query") {
      setQuery("");
      setDebouncedQuery("");
      return;
    }
    if (field === "lang") {
      setFilters((current) => ({ ...current, lang: "all" }));
      return;
    }
    setFilters((current) => ({ ...current, [field]: undefined }));
  };

  const clearAll = () => {
    setQuery("");
    setDebouncedQuery("");
    setFilters(defaultFilters);
    setPage(1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDebouncedQuery(query);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_4%,rgba(91,107,255,0.15),transparent_28%),radial-gradient(circle_at_96%_0%,rgba(26,201,175,0.13),transparent_30%),linear-gradient(180deg,#f9fafe,#f6f7fc)] dark:bg-[linear-gradient(180deg,#121626,#0f172a)]">
      <SearchHeader query={query} onQueryChange={setQuery} onOpenUpload={() => setUploadOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="mb-6 rounded-[1.6rem] border bg-[hsl(var(--card))]/85 p-6 shadow-soft backdrop-blur"
        >
          <div className="mb-5 flex items-center justify-center">
            <div className="inline-flex rounded-2xl border bg-[hsl(var(--background))] p-1">
              <Button variant={mode === "search" ? "default" : "ghost"} onClick={() => setMode("search")}>Search</Button>
              <Button variant={mode === "ask" ? "default" : "ghost"} onClick={() => setMode("ask")}>Ask</Button>
            </div>
          </div>

          {mode === "search" ? (
            <form onSubmit={submitSearch} className="mx-auto flex w-full max-w-4xl items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contracts, policies and evidence..." className="h-16 rounded-2xl pl-12 text-base" />
              </div>
              <Button type="submit" size="lg" className="h-16 px-7">Search</Button>
            </form>
          ) : (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">Haz preguntas y obtén respuesta con fuentes.</p>
          )}
        </motion.section>

        {mode === "search" ? (
          <section className="grid gap-6 lg:grid-cols-[290px_1fr]">
            <FilterSidebar filters={filters} onChange={setFilters} />
            <div>
              {hasActiveFilters ? (
                <AppliedFilters filters={filters} query={query} onRemove={removeListFilter} onClearField={clearField} onClearAll={clearAll} />
              ) : null}
              <ResultsPanel data={data} loading={loading} page={page} onPageChange={setPage} />
            </div>
          </section>
        ) : (
          <AskView defaultQuestion={query} />
        )}
      </main>

      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onQuerySelect={setQuery}
        onOpenUpload={() => setUploadOpen(true)}
        onModeChange={setMode}
      />
    </div>
  );
}
