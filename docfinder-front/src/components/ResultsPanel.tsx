"use client";

import { DatabaseZap, Grid2X2, List, SearchX, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { ResultCard } from "@/components/ResultCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SearchResponse } from "@/lib/types";

function LoadingSkeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}><CardContent className="space-y-3 p-5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </CardContent></Card>
      ))}
    </div>
  );
}

const pageWindow = (current: number, total: number) => {
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
};

export function ResultsPanel({ data, loading, page, onPageChange }: { data: SearchResponse | null; loading: boolean; page: number; onPageChange: (value: number) => void }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const pages = useMemo(() => (data ? pageWindow(page, data.totalPages) : []), [data, page]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-[hsl(var(--card))] px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <span>{loading ? "Loading results..." : `${data?.total ?? 0} documents matched`}</span>
          {data?.source ? (
            <Badge variant={data.source === "backend" ? "default" : "secondary"}>
              <DatabaseZap className="mr-1 h-3 w-3" />
              {data.source === "backend" ? "Backend" : "Mock"}
            </Badge>
          ) : null}
        </div>
        <div className="inline-flex rounded-xl border p-1">
          <Button variant={view === "grid" ? "default" : "ghost"} size="sm" onClick={() => setView("grid")}><Grid2X2 className="h-4 w-4" /></Button>
          <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {!loading && data?.warning ? (
        <Card className="border-amber-300/50 bg-amber-100/40 dark:border-amber-500/40 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-2 p-3 text-xs text-amber-800 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{data.warning}</p>
          </CardContent>
        </Card>
      ) : null}

      {loading ? <LoadingSkeletons /> : null}

      {!loading && data && data.hits.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <SearchX className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Try another query or relax some filters.</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && data && data.hits.length > 0 ? (
        <div className={cn("grid gap-4", view === "grid" ? "md:grid-cols-2" : "grid-cols-1")}>
          {data.hits.map((hit, idx) => <ResultCard key={hit.chunk_id} hit={hit} view={view} index={idx} />)}
        </div>
      ) : null}

      {!loading && data && data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
          {pages.map((p) => (
            <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => onPageChange(p)}>{p}</Button>
          ))}
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      ) : null}
    </section>
  );
}
