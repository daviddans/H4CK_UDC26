"use client";

import Link from "next/link";
import { CalendarDays, FileText, Globe, Layers, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SearchHit } from "@/lib/types";

export function ResultCard({ hit, view, index }: { hit: SearchHit; view: "grid" | "list"; index: number }) {
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.03 }}>
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-xl">
        <CardHeader className={cn("gap-3", view === "list" && "sm:flex-row sm:justify-between")}>
          <div className="space-y-2">
            <Link href={`/documents/${hit.doc_id}`} className="text-lg font-semibold leading-tight hover:text-[hsl(var(--primary))]">
              {hit.title}
            </Link>
            <div className="flex flex-wrap gap-2">
              <Badge>{hit.doc_type}</Badge>
              <Badge variant="secondary">{hit.category}</Badge>
              {hit.tags.map((tag) => (
                <Badge key={`${hit.chunk_id}-${tag}`} variant="outline">#{tag}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-2 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
            <Sparkles className="h-3.5 w-3.5" />
            {(hit.score * 100).toFixed(0)}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]" dangerouslySetInnerHTML={{ __html: hit.snippet_html }} />
          <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />p. {hit.page_start}-{hit.page_end}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{hit.date}</span>
            <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{hit.lang.toUpperCase()}</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{hit.doc_id}</span>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}
