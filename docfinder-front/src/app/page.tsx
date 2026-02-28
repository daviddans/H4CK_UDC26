"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CommandIcon,
  Grid3X3,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import type { AskResponse, SearchApiResponse, SearchFilters, SearchMode } from "@/types/docfinder";
import { AskPanel } from "@/components/docfinder/ask-panel";
import { CommandPalette } from "@/components/docfinder/command-palette";
import { FilterSidebar } from "@/components/docfinder/filter-sidebar";
import { ResultCard } from "@/components/docfinder/result-card";
import { ResultSkeleton } from "@/components/docfinder/result-skeleton";
import { ThemeToggle } from "@/components/docfinder/theme-toggle";
import { UploadModal } from "@/components/docfinder/upload-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

const DEFAULT_FILTERS: SearchFilters = {
  doc_type: [],
  category: [],
  tags: [],
  lang: [],
  from: "",
  to: "",
  sort: "relevance",
};

const INITIAL_DATA: SearchApiResponse = {
  hits: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  hasMore: false,
  available: {
    docTypes: [],
    categories: [],
    tags: [],
    langs: [],
  },
};

function buildPagination(current: number, totalPages: number) {
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);
  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

export default function HomePage() {
  const [mode, setMode] = useState<SearchMode>("search");
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [data, setData] = useState<SearchApiResponse>(INITIAL_DATA);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (mode !== "search") {
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(async () => {
      if (disposed) {
        return;
      }
      setLoading(true);
      setSearchError(null);
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: query,
            page,
            pageSize: PAGE_SIZE,
            mode,
            filters,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as
          | SearchApiResponse
          | { error?: string; details?: string[] };

        if (!response.ok) {
          const reason =
            (typeof payload === "object" && payload && "error" in payload && payload.error) ||
            "Search failed";
          const details =
            typeof payload === "object" &&
            payload &&
            "details" in payload &&
            Array.isArray(payload.details)
              ? payload.details[0]
              : undefined;
          throw new Error(details ? `${reason}: ${details}` : reason);
        }

        if (!disposed) {
          setData(payload as SearchApiResponse);
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");
        if (isAbort) {
          return;
        }
        if (!disposed) {
          setSearchError(error instanceof Error ? error.message : "Search request failed");
          setData((prev) => ({ ...prev, hits: [], total: 0, hasMore: false }));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [filters, mode, page, query]);

  const onAsk = async () => {
    setAskLoading(true);
    setAskResponse(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const payload = (await response.json()) as
        | AskResponse
        | { error?: string; details?: string[] };
      if (!response.ok) {
        const reason =
          (typeof payload === "object" && payload && "error" in payload && payload.error) ||
          "Ask failed";
        const details =
          typeof payload === "object" &&
          payload &&
          "details" in payload &&
          Array.isArray(payload.details)
            ? payload.details[0]
            : undefined;
        throw new Error(details ? `${reason}: ${details}` : reason);
      }

      setAskResponse(payload as AskResponse);
    } catch (error) {
      setAskResponse({
        answer: error instanceof Error ? error.message : "Ask request failed",
        citations: [],
      });
    } finally {
      setAskLoading(false);
    }
  };

  const appliedFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; remove: () => void }> = [];

    filters.doc_type.forEach((value) =>
      chips.push({
        key: `doc_type-${value}`,
        label: `type: ${value}`,
        remove: () =>
          setFilters((prev) => ({
            ...prev,
            doc_type: prev.doc_type.filter((item) => item !== value),
          })),
      })
    );

    filters.category.forEach((value) =>
      chips.push({
        key: `category-${value}`,
        label: `category: ${value}`,
        remove: () =>
          setFilters((prev) => ({
            ...prev,
            category: prev.category.filter((item) => item !== value),
          })),
      })
    );

    filters.tags.forEach((value) =>
      chips.push({
        key: `tag-${value}`,
        label: `tag: ${value}`,
        remove: () =>
          setFilters((prev) => ({
            ...prev,
            tags: prev.tags.filter((item) => item !== value),
          })),
      })
    );

    filters.lang.forEach((value) =>
      chips.push({
        key: `lang-${value}`,
        label: `lang: ${value}`,
        remove: () =>
          setFilters((prev) => ({
            ...prev,
            lang: prev.lang.filter((item) => item !== value),
          })),
      })
    );

    if (filters.from) {
      chips.push({
        key: "from",
        label: `from: ${filters.from}`,
        remove: () => setFilters((prev) => ({ ...prev, from: "" })),
      });
    }

    if (filters.to) {
      chips.push({
        key: "to",
        label: `to: ${filters.to}`,
        remove: () => setFilters((prev) => ({ ...prev, to: "" })),
      });
    }

    return chips;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="relative min-h-screen overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),transparent_40%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.18),transparent_34%)]" />

      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/75 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/75">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white shadow-lg shadow-slate-900/30 dark:bg-slate-100 dark:text-slate-900">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">DocFinder</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">document intelligence</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900 md:flex">
            <button
              type="button"
              onClick={() => setMode("search")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                mode === "search"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setMode("ask")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                mode === "ask"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              )}
            >
              Ask
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" onClick={() => setPaletteOpen(true)}>
              <CommandIcon className="h-4 w-4" />
              Ctrl+K
            </Button>
            <UploadModal
              trigger={
                <Button variant="accent" size="lg" className="hidden md:inline-flex">
                  <UploadCloud className="h-4 w-4" />
                  Upload
                </Button>
              }
            />
          </div>
        </div>
      </header>

      <main className="relative mx-auto mt-7 w-full max-w-[1440px] px-4 md:px-8">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-[0_16px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/70 md:p-5"
        >
          <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700/75 dark:text-cyan-300/70">
            Enterprise Document Search
          </p>
          <h1 className="mb-3 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">
            Find evidence in seconds
          </h1>

          {mode === "search" && (
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-[1.6rem] border border-slate-200 bg-white px-4 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              <Input
                value={query}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
                placeholder="Search by clause, control, policy, incident, vendor..."
                className="h-10 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
              />
              <Button variant="accent" className="rounded-2xl" onClick={() => setPage(1)}>
                Search
              </Button>
            </div>
          )}

          {mode === "ask" && (
            <div className="mx-auto max-w-3xl text-center text-sm text-slate-500 dark:text-slate-400">
              Ask a natural language question and get an answer with grounded sources.
            </div>
          )}

          <div className="mt-3 flex justify-center md:hidden">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMode("search")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  mode === "search"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setMode("ask")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  mode === "ask"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Ask
              </button>
            </div>
          </div>
        </motion.section>

        {mode === "ask" ? (
          <AskPanel
            question={question}
            onChange={setQuestion}
            onAsk={onAsk}
            loading={askLoading}
            response={askResponse}
          />
        ) : (
          <section className="space-y-3">
            <aside className={cn("order-1", mobileFiltersOpen ? "block" : "hidden md:block")}>
              <FilterSidebar
                filters={filters}
                available={data.available}
                onUpdate={(next) => {
                  setPage(1);
                  setFilters(next);
                }}
              />
            </aside>

            <div className="order-2 space-y-3">
              <div className="space-y-2 px-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    {data.total} results
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="md:hidden"
                      onClick={() => setMobileFiltersOpen((prev) => !prev)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {mobileFiltersOpen ? "Hide filters" : "Filters"}
                    </Button>
                    <Button
                      variant={view === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setView("grid")}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={view === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setView("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {appliedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {appliedFilters.map((chip) => (
                      <Badge key={chip.key} variant="outline" className="gap-1">
                        {chip.label}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          onClick={chip.remove}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {loading ? (
                <div
                  className={cn(
                    "grid gap-4",
                    view === "grid" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {Array.from({ length: 6 }).map((_, index) => (
                    <ResultSkeleton key={index} />
                  ))}
                </div>
              ) : searchError ? (
                <Card className="rounded-3xl border-rose-200 dark:border-rose-500/30">
                  <CardContent className="flex items-start gap-3 py-8 text-left">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-500" />
                    <div>
                      <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Backend search error</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{searchError}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : data.hits.length === 0 ? (
                <Card className="rounded-3xl border-dashed dark:border-slate-700">
                  <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                    <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">No results found</h2>
                    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                      Try a different query, remove filters, or switch to Ask mode for a broader semantic answer.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div
                    className={cn(
                      "grid gap-4",
                      view === "grid" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
                    )}
                  >
                    {data.hits.map((hit) => (
                      <ResultCard key={hit.chunk_id} hit={hit} view={view} />
                    ))}
                  </div>

                  <Card className="rounded-3xl">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Page {data.page} of {totalPages}
                      </p>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={data.page <= 1}
                          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                        >
                          Prev
                        </Button>
                        {buildPagination(data.page, totalPages).map((pageNumber) => (
                          <Button
                            key={pageNumber}
                            variant={data.page === pageNumber ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setPage(pageNumber)}
                          >
                            {pageNumber}
                          </Button>
                        ))}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={data.page >= totalPages}
                          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                        >
                          Next
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectQuery={(selectedQuery) => {
          setMode("search");
          setQuery(selectedQuery);
          setPage(1);
        }}
      />
    </div>
  );
}
