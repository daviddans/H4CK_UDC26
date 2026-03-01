"use client";

import Link from "next/link";
import { Calendar, Check, FileText, FileType2, Languages, Sparkles, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

import type { DocumentHit, ResultsView } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ResultCardProps = {
  hit: DocumentHit;
  view: ResultsView;
  onDelete?: (docId: string) => void;
  deleting?: boolean;
  libraryMode?: boolean;
  detailHref?: string;
  highlightQuery?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (docId: string) => void;
};

type TextRange = { start: number; end: number };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function mergeRanges(ranges: TextRange[]) {
  if (!ranges.length) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function highlightTitleHtml(title: string, query: string) {
  const cleanTitle = title ?? "";
  const tokens = Array.from(
    new Set(
      query
        .split(/\s+/)
        .map((token) => normalizeToken(token.trim()))
        .filter((token) => token.length > 1)
    )
  ).slice(0, 8);

  if (!tokens.length) {
    return escapeHtml(cleanTitle);
  }

  const ranges: TextRange[] = [];
  for (const match of cleanTitle.matchAll(/[\p{L}\p{N}]+/gu)) {
    const rawWord = match[0] ?? "";
    const start = match.index ?? -1;
    if (start < 0 || !rawWord) {
      continue;
    }
    const wordNorm = normalizeToken(rawWord);
    if (!tokens.includes(wordNorm)) {
      continue;
    }
    ranges.push({ start, end: start + rawWord.length });
  }

  const merged = mergeRanges(ranges);
  if (!merged.length) {
    return escapeHtml(cleanTitle);
  }

  let html = "";
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      html += escapeHtml(cleanTitle.slice(cursor, range.start));
    }
    html += `<mark>${escapeHtml(cleanTitle.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  if (cursor < cleanTitle.length) {
    html += escapeHtml(cleanTitle.slice(cursor));
  }
  return html;
}

export function ResultCard({
  hit,
  view,
  onDelete,
  deleting = false,
  libraryMode = false,
  detailHref,
  highlightQuery = "",
  selectable = false,
  selected = false,
  onToggleSelect,
}: ResultCardProps) {
  const showDocId = !hit.doc_id.startsWith("UPL-");
  const canDelete = hit.doc_id.startsWith("UPL-") && Boolean(onDelete);
  const href = detailHref ?? `/document/${hit.doc_id}`;
  const normalizedCategory = hit.category?.trim().toLowerCase() ?? "";
  const showCategory = Boolean(hit.category) && !["backend", "indexed", "uploaded"].includes(normalizedCategory);
  const safePageStart = Math.max(1, hit.page_start);
  const safePageEnd = Math.max(safePageStart, hit.page_end);
  const safeTotalPages = hit.total_pages
    ? Math.max(hit.total_pages, safePageEnd)
    : undefined;
  const titleHtml = highlightTitleHtml(hit.title, highlightQuery);
  const hasSinglePage = safePageStart === safePageEnd;
  const pageLabel = safeTotalPages && safeTotalPages > 0
    ? hasSinglePage
      ? `pag. ${safePageStart}/${safeTotalPages}`
      : `pag. ${safePageStart}-${safePageEnd}/${safeTotalPages}`
    : hasSinglePage
      ? `pag. ${safePageStart}`
      : `pag. ${safePageStart}-${safePageEnd}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden border-slate-200/90 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:hover:shadow-[0_24px_54px_rgba(0,0,0,0.45)]",
          view === "list" && "flex flex-col"
        )}
      >
        {selectable ? (
          <button
            type="button"
            className={cn(
              "absolute right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
              selected
                ? "border-cyan-500 bg-cyan-500 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-900"
                : "border-slate-300 bg-white text-transparent hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-900"
            )}
            onClick={() => onToggleSelect?.(hit.doc_id)}
            aria-label={selected ? `Unselect ${hit.title}` : `Select ${hit.title}`}
            aria-pressed={selected}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <CardHeader className="space-y-4 pb-3">
          {libraryMode ? (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                  <FileType2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                  <span className="capitalize">{hit.doc_type}</span>
                </div>
                <div className="text-right">
                  {hit.date ? (
                    <span className="block text-[11px] text-slate-500 dark:text-slate-300">
                      {hit.date}
                    </span>
                  ) : null}
                  <span className="block text-[11px] text-slate-500 dark:text-slate-300">
                    {hit.page_end} pages
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" className="capitalize">
                {hit.doc_type}
              </Badge>
              {showCategory ? (
                <Badge variant="outline" className="capitalize">
                  {hit.category}
                </Badge>
              ) : null}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5" />
                {hit.score.toFixed(2)}
              </span>
            </div>
          )}
          <CardTitle className="text-lg leading-6">
            <Link href={href} className="hover:text-cyan-700 dark:hover:text-cyan-300">
              <span
                className="title-highlight [&_mark]:rounded-sm [&_mark]:bg-cyan-100 [&_mark]:px-0.5 [&_mark]:text-slate-900 dark:[&_mark]:bg-cyan-500/35 dark:[&_mark]:text-slate-50"
                dangerouslySetInnerHTML={{ __html: titleHtml }}
              />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {!libraryMode ? (
            <div
              className="line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              dangerouslySetInnerHTML={{ __html: hit.snippet_html }}
            />
          ) : null}

          {hit.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {hit.tags.map((tag) => (
                <Badge key={`${hit.chunk_id}-${tag}`} variant="default" className="capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          {!libraryMode ? (
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-4">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {hit.date || "unknown"}
              </span>
              <span className="inline-flex items-center gap-1 capitalize">
                <Languages className="h-3.5 w-3.5" />
                {hit.lang}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {pageLabel}
              </span>
              <span className="truncate text-right text-slate-400 dark:text-slate-500">
                {showDocId ? hit.doc_id : ""}
              </span>
            </div>
          ) : null}

          <div className="mt-auto flex justify-end">
            {canDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                onClick={() => onDelete?.(hit.doc_id)}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
