"use client";

import Link from "next/link";
import { Calendar, FileText, Languages, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import type { DocumentHit, ResultsView } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ResultCardProps = {
  hit: DocumentHit;
  view: ResultsView;
};

export function ResultCard({ hit, view }: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-slate-200/90 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:hover:shadow-[0_24px_54px_rgba(0,0,0,0.45)]",
          view === "list" && "flex flex-col"
        )}
      >
        <CardHeader className="space-y-4 pb-3">
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
          <CardTitle className="text-lg leading-6">
            <Link href={`/document/${hit.doc_id}`} className="hover:text-cyan-700 dark:hover:text-cyan-300">
              {hit.title}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: hit.snippet_html }}
          />

          <div className="flex flex-wrap gap-2">
            {hit.tags.map((tag) => (
              <Badge key={`${hit.chunk_id}-${tag}`} variant="default" className="capitalize">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-4">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {hit.date}
            </span>
            <span className="inline-flex items-center gap-1 capitalize">
              <Languages className="h-3.5 w-3.5" />
              {hit.lang}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              pag. {hit.page_start}-{hit.page_end}
            </span>
            <span className="truncate text-right text-slate-400 dark:text-slate-500">{hit.doc_id}</span>
          </div>

          <div className="flex justify-end">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/document/${hit.doc_id}`}>Open detail</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
