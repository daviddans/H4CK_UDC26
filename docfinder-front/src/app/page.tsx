"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
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
  tags: [],
  lang: [],
  from: "",
  to: "",
  sort: "relevance_desc",
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
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [data, setData] = useState<SearchApiResponse>(INITIAL_DATA);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
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
    const question = query.trim();
    if (!question) {
      setAskResponse({
        answer: "Write a question first.",
        citations: [],
      });
      return;
    }

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.10),transparent_28%)]" />

      <header className="sticky top-0 z-30 border-b border-white/75 bg-white/80 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white shadow-lg shadow-slate-900/30 dark:bg-slate-100 dark:text-slate-900">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">DocFinder</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">document intelligence</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UploadModal
              suggestedTags={data.available.tags}
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
          className="mb-4 rounded-3xl border border-white/85 bg-white/85 p-4 shadow-[0_16px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700/90 dark:bg-slate-900/80 md:p-6"
        >
          <h1 className="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">
            What do you want to find?
          </h1>

          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setMode("search")}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  mode === "search"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-300"
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
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-300"
                )}
              >
                Ask
              </button>
            </div>
          </div>

          {mode === "search" ? (
            <div className="mx-auto flex w-full max-w-6xl items-center gap-3 rounded-[1.7rem] border border-slate-200 bg-white px-5 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-300" />
              <Input
                value={query}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
                placeholder="Search by clause, control, policy, incident, vendor..."
                className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-lg"
              />
              <Button variant="accent" className="h-11 rounded-2xl px-5" onClick={() => setPage(1)}>
                Search
              </Button>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-6xl items-center gap-3 rounded-[1.7rem] border border-slate-200 bg-white px-5 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
              <Search className="h-5 w-5 text-slate-400 dark:text-slate-300" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask a question about your indexed documents..."
                className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:text-lg"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onAsk();
                  }
                }}
              />
              <Button variant="accent" className="h-11 rounded-2xl px-5" onClick={() => void onAsk()}>
                Send
              </Button>
            </div>
          )}
        </motion.section>

        {mode === "ask" ? (
          <AskPanel
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
                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-300" />
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
                      <Badge key={chip.key} variant="outline" className="gap-1.5">
                        {chip.label}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
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
                <Card className="rounded-3xl border-rose-200 dark:border-rose-500/40">
                  <CardContent className="flex items-start gap-3 py-8 text-left">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-500" />
                    <div>
                      <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Backend search error</h2>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{searchError}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : data.hits.length === 0 ? (
                <Card className="rounded-3xl border-dashed dark:border-slate-700">
                  <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                    <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-500" />
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-100">No results found</h2>
                    <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
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
                      <p className="text-sm text-slate-600 dark:text-slate-300">
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
    </div>
  );
}
