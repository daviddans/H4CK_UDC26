"use client";

import { CalendarDays, Download, ExternalLink, Globe, Layers, Tag } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentRecord, SearchHit } from "@/lib/types";

export function DocumentDetailView({ document, evidence }: { document: DocumentRecord; evidence: SearchHit[] }) {
  const [selectedPage, setSelectedPage] = useState(evidence[0]?.page_start ?? 1);
  const previewUrl = useMemo(() => `${document.file_url}#page=${selectedPage}`, [document.file_url, selectedPage]);

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr_320px]">
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Title</p>
            <p className="text-sm font-semibold">{document.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{document.doc_type}</Badge>
            <Badge variant="secondary">{document.category}</Badge>
          </div>
          <div>
            <p className="mb-1 inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]"><Tag className="h-3.5 w-3.5" />Tags</p>
            <div className="flex flex-wrap gap-1.5">{document.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}</div>
          </div>
          <div className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <p className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{document.lang.toUpperCase()}</p>
            <p className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{document.date}</p>
            <p className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{document.doc_id}</p>
          </div>
          <div className="grid gap-2">
            <Button asChild><a href={document.file_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open</a></Button>
            <Button variant="outline" asChild><a href={document.file_url} download><Download className="h-4 w-4" />Download</a></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">PDF preview</CardTitle>
          <Button variant="outline" size="sm" asChild><a href={previewUrl} target="_blank" rel="noreferrer">Open in new tab</a></Button>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[560px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
            <p className="text-lg font-semibold">PDF preview</p>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">No embedded viewer configured.</p>
            <p className="mt-3 rounded-xl bg-[hsl(var(--muted))] px-3 py-1.5 text-sm">Current page: {selectedPage}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Evidencias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {evidence.map((item) => (
            <article key={item.chunk_id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-lg bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">p. {item.page_start}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPage(item.page_start)}>Ir a página</Button>
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]" dangerouslySetInnerHTML={{ __html: item.snippet_html }} />
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
