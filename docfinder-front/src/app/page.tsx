"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

import type { AskResponse, SearchApiResponse, SearchFilters, SearchMode, SortMode } from "@/types/docfinder";
import { AskPanel } from "@/components/docfinder/ask-panel";
import { FilterSidebar } from "@/components/docfinder/filter-sidebar";
import { ResultCard } from "@/components/docfinder/result-card";
import { ResultSkeleton } from "@/components/docfinder/result-skeleton";
import { ThemeToggle } from "@/components/docfinder/theme-toggle";
import { UploadModal } from "@/components/docfinder/upload-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PAGE_SIZE_SEARCH = 6;
const PAGE_SIZE_LIBRARY = 8;
const SEARCH_HISTORY_KEY = "docfinder:search-history";

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
  pageSize: PAGE_SIZE_SEARCH,
  hasMore: false,
  available: {
    docTypes: [],
    categories: [],
    tags: [],
    langs: [],
  },
};

function parseListParam(value: string | null) {
  if (!value) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function parsePositiveIntParam(value: string | null, fallback = 1) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseSortParam(value: string | null): SortMode {
  if (value === "relevance_asc" || value === "date_desc" || value === "date_asc") {
    return value;
  }
  return "relevance_desc";
}

function buildPagination(current: number, totalPages: number) {
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);
  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

export default function HomePage() {
  const router = useRouter();
  const restoredFromUrlRef = useRef(false);
  const searchTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const askTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [stateReady, setStateReady] = useState(false);
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
  const [refreshToken, setRefreshToken] = useState(0);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchTick, setSearchTick] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (restoredFromUrlRef.current) {
      return;
    }

    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const modeParam = params.get("mode");
    const queryParam = params.get("q");
    const pageParam = params.get("page");
    const viewParam = params.get("view");
    const docTypeParam = params.get("docType");
    const tagsParam = params.get("tags");
    const langParam = params.get("lang");
    const fromParam = params.get("fromDate");
    const toParam = params.get("toDate");
    const sortParam = params.get("sort");

    const nextMode: SearchMode = modeParam === "ask" ? "ask" : "search";
    const nextView = viewParam === "list" ? "list" : "grid";

    setMode(nextMode);
    setQuery(queryParam ?? "");
    setPage(parsePositiveIntParam(pageParam, 1));
    setView(nextView);
    setFilters({
      doc_type: parseListParam(docTypeParam),
      tags: parseListParam(tagsParam),
      lang: parseListParam(langParam),
      from: fromParam ?? "",
      to: toParam ?? "",
      sort: parseSortParam(sortParam),
    });

    restoredFromUrlRef.current = true;
    setStateReady(true);
  }, []);

  useEffect(() => {
    if (!stateReady) {
      return;
    }

    const nextParams = new URLSearchParams();
    if (mode === "ask") {
      nextParams.set("mode", "ask");
    }
    if (query.trim()) {
      nextParams.set("q", query.trim());
    }
    if (page > 1) {
      nextParams.set("page", String(page));
    }
    if (view === "list") {
      nextParams.set("view", "list");
    }
    if (filters.doc_type.length > 0) {
      nextParams.set("docType", filters.doc_type.join(","));
    }
    if (filters.tags.length > 0) {
      nextParams.set("tags", filters.tags.join(","));
    }
    if (filters.lang.length > 0) {
      nextParams.set("lang", filters.lang.join(","));
    }
    if (filters.from) {
      nextParams.set("fromDate", filters.from);
    }
    if (filters.to) {
      nextParams.set("toDate", filters.to);
    }
    if (filters.sort !== "relevance_desc") {
      nextParams.set("sort", filters.sort);
    }

    const current =
      typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : "";
    const next = nextParams.toString();
    if (current === next) {
      return;
    }

    router.replace(next ? `/?${next}` : "/", { scroll: false });
  }, [filters, mode, page, query, router, stateReady, view]);

  const libraryMode = mode === "search" && query.trim().length === 0;
  const searchQueryParam = query.trim();
  const encodedSearchQueryParam = searchQueryParam
    ? encodeURIComponent(searchQueryParam)
    : "";
  const visibleDocIds = useMemo(
    () => Array.from(new Set(data.hits.map((hit) => hit.doc_id))),
    [data.hits]
  );
  const deletableSelectedDocIds = useMemo(
    () => selectedDocIds.filter((docId) => docId.startsWith("UPL-")),
    [selectedDocIds]
  );

  useEffect(() => {
    if (!stateReady || mode !== "search") {
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
        const requestPageSize = libraryMode ? PAGE_SIZE_LIBRARY : PAGE_SIZE_SEARCH;
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: query,
            page,
            pageSize: requestPageSize,
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
  }, [filters, mode, page, query, refreshToken, libraryMode, searchTick, stateReady]);

  useEffect(() => {
    if (!libraryMode) {
      setSelectedDocIds([]);
      return;
    }
    const visible = new Set(visibleDocIds);
    setSelectedDocIds((prev) => prev.filter((docId) => visible.has(docId)));
  }, [libraryMode, visibleDocIds]);

  const onDeleteFromList = async (docId: string) => {
    if (deletingDocId || bulkDeleting) {
      return;
    }

    const approved = window.confirm("Delete this document?");
    if (!approved) {
      return;
    }

    setDeletingDocId(docId);
    setSearchError(null);
    try {
      const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed");
      }
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingDocId(null);
    }
  };

  const onToggleSelect = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const onDeleteSelected = async () => {
    if (selectedDocIds.length === 0 || deletingDocId || bulkDeleting) {
      return;
    }
    if (deletableSelectedDocIds.length === 0) {
      setSearchError("Selected documents cannot be deleted.");
      return;
    }
    const skippedCount = selectedDocIds.length - deletableSelectedDocIds.length;

    const approved = window.confirm(
      `Delete ${deletableSelectedDocIds.length} selected document(s)?`
    );
    if (!approved) {
      return;
    }

    setBulkDeleting(true);
    setSearchError(null);
    try {
      const results = await Promise.allSettled(
        deletableSelectedDocIds.map(async (docId) => {
          const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? `Delete failed for ${docId}`);
          }
          return docId;
        })
      );

      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        const successCount = results.length - failed.length;
        setSearchError(`Deleted ${successCount} document(s). ${failed.length} delete(s) failed.`);
      } else if (skippedCount > 0) {
        setSearchError(`Deleted ${results.length} document(s). ${skippedCount} could not be deleted.`);
      }

      setSelectedDocIds([]);
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

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

  const triggerSearch = () => {
    setSearchFocused(false);
    setPage(1);
    setSearchTick((prev) => prev + 1);
  };

  const clearQuery = () => {
    setQuery("");
    setPage(1);
  };

  const persistSearchHistory = (nextHistory: string[]) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const saveSearchTerm = (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term) {
      return;
    }
    setSearchHistory((prev) => {
      const deduped = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 12);
      persistSearchHistory(deduped);
      return deduped;
    });
  };

  const removeSearchTerm = (rawTerm: string) => {
    const term = rawTerm.trim().toLowerCase();
    if (!term) {
      return;
    }
    setSearchHistory((prev) => {
      const next = prev.filter((item) => item.trim().toLowerCase() !== term);
      persistSearchHistory(next);
      return next;
    });
  };

  const suggestions = useMemo(() => {
    if (mode !== "search") {
      return [];
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      return searchHistory.slice(0, 3);
    }
    const startsWith = searchHistory.filter((item) => item.toLowerCase().startsWith(term));
    const contains = searchHistory.filter(
      (item) => !item.toLowerCase().startsWith(term) && item.toLowerCase().includes(term)
    );
    return [...startsWith, ...contains].slice(0, 3);
  }, [mode, query, searchHistory]);

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

  const totalPages = Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize)));
  const gridClassName =
    view === "grid"
      ? libraryMode
        ? "grid-cols-2 xl:grid-cols-4"
        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-2"
      : "grid-cols-1";

  useEffect(() => {
    autoResizeTextarea(searchTextareaRef.current);
    autoResizeTextarea(askTextareaRef.current);
  }, [mode, query]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      const cleaned = parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 12);
      setSearchHistory(cleaned);
    } catch {
      setSearchHistory([]);
    }
  }, []);

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
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">GandalFS &lt;&gt;</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">document intelligence</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UploadModal
              suggestedTags={data.available.tags}
              onUploaded={() => setRefreshToken((prev) => prev + 1)}
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
            {mode === "ask" ? "Want to ask?" : "What do you want to find?"}
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
            <div className="relative mx-auto w-full max-w-6xl">
              <div className="flex items-end gap-3 rounded-[1.7rem] border border-slate-200 bg-white px-5 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
                <Search className="mt-3 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-300" />
                <textarea
                  ref={searchTextareaRef}
                  value={query}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  onInput={(event) => autoResizeTextarea(event.currentTarget)}
                  placeholder="Search documents... (leave empty to see all files)"
                  rows={1}
                  className="max-h-[220px] min-h-[48px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-3 text-base leading-6 shadow-none outline-none md:text-lg"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      saveSearchTerm(query);
                      triggerSearch();
                    }
                  }}
                />
                {query ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    onClick={clearQuery}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  variant="accent"
                  className="h-11 rounded-2xl px-5"
                  onClick={() => {
                    saveSearchTerm(query);
                    triggerSearch();
                  }}
                >
                  Search
                </Button>
              </div>
              {searchFocused && suggestions.length > 0 ? (
                <div className="mt-2 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
                  {suggestions.map((item) => (
                    <div
                      key={item}
                      className="group flex w-full items-center gap-1 rounded-xl px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setQuery(item);
                          setPage(1);
                          saveSearchTerm(item);
                          setSearchTick((prev) => prev + 1);
                          setSearchFocused(false);
                        }}
                        className="min-w-0 flex-1 truncate rounded-lg px-1 py-1 text-left"
                        title={item}
                      >
                        {item}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => removeSearchTerm(item)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        aria-label={`Remove ${item} from search history`}
                        title="Remove from history"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-6xl items-end gap-3 rounded-[1.7rem] border border-slate-200 bg-white px-5 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
              <Search className="mt-3 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-300" />
              <textarea
                ref={askTextareaRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onInput={(event) => autoResizeTextarea(event.currentTarget)}
                placeholder="Ask a question about your indexed documents..."
                rows={1}
                className="max-h-[220px] min-h-[48px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-3 text-base leading-6 shadow-none outline-none md:text-lg"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onAsk();
                  }
                }}
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={clearQuery}
                  aria-label="Clear question"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
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
                    {data.total} {libraryMode ? "documents" : "results"}
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
                      disabled={bulkDeleting}
                      onClick={() => setView("grid")}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={view === "list" ? "default" : "ghost"}
                      size="sm"
                      disabled={bulkDeleting}
                      onClick={() => setView("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {libraryMode && data.hits.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white/70 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                    <span className="text-slate-700 dark:text-slate-200">
                      {selectedDocIds.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading || bulkDeleting || selectedDocIds.length === visibleDocIds.length}
                        onClick={() => setSelectedDocIds(visibleDocIds)}
                      >
                        Select all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading || bulkDeleting || selectedDocIds.length === 0}
                        onClick={() => setSelectedDocIds([])}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        disabled={loading || bulkDeleting || deletableSelectedDocIds.length === 0}
                        onClick={() => void onDeleteSelected()}
                      >
                        {bulkDeleting ? "Deleting..." : "Delete selected"}
                      </Button>
                    </div>
                  </div>
                ) : null}

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
                <div className={cn("grid gap-4", gridClassName)}>
                  {Array.from({ length: libraryMode ? PAGE_SIZE_LIBRARY : PAGE_SIZE_SEARCH }).map((_, index) => (
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
                    className={cn("grid gap-4", gridClassName)}
                  >
                    {data.hits.map((hit) => (
                      <ResultCard
                        key={libraryMode ? hit.doc_id : hit.chunk_id}
                        hit={hit}
                        view={view}
                        highlightQuery={libraryMode ? "" : query}
                        onDelete={onDeleteFromList}
                        deleting={bulkDeleting || deletingDocId === hit.doc_id}
                        libraryMode={libraryMode}
                        selectable={libraryMode}
                        selected={selectedDocIds.includes(hit.doc_id)}
                        onToggleSelect={onToggleSelect}
                        detailHref={
                          libraryMode
                            ? `/document/${hit.doc_id}?from=library`
                            : `/document/${hit.doc_id}?from=search${
                                encodedSearchQueryParam ? `&q=${encodedSearchQueryParam}` : ""
                              }`
                        }
                      />
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
