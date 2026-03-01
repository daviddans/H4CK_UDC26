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
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (docId: string) => void;
};

export function ResultCard({
  hit,
  view,
  onDelete,
  deleting = false,
  libraryMode = false,
  detailHref,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ResultCardProps) {
  const showDocId = !hit.doc_id.startsWith("UPL-");
  const canDelete = hit.doc_id.startsWith("UPL-") && Boolean(onDelete);
  const href = detailHref ?? `/document/${hit.doc_id}`;
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
              <Badge variant="outline" className="capitalize">
                {hit.category}
              </Badge>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5" />
                {hit.score.toFixed(2)}
              </span>
            </div>
          )}
          <CardTitle className="text-lg leading-6">
            <Link href={href} className="hover:text-cyan-700 dark:hover:text-cyan-300">
              {hit.title}
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
                pag. {hit.page_start}-{hit.page_end}
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
