"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, Download, FileText, Languages, Tag } from "lucide-react";

import type { DocumentDetail } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentDetailPage() {
  const params = useParams<{ docId: string }>();
  const docId = params.docId;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDocument() {
      setLoading(true);
      try {
        const response = await fetch(`/api/documents/${docId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setDocument(null);
          return;
        }

        const payload = (await response.json()) as DocumentDetail;
        setDocument(payload);
        setSelectedPage(payload.chunks[0]?.page_start ?? null);
      } finally {
        setLoading(false);
      }
    }

    if (docId) {
      fetchDocument();
    }

    return () => controller.abort();
  }, [docId]);

  const selectedChunk = useMemo(
    () => document?.chunks.find((chunk) => chunk.page_start === selectedPage),
    [document, selectedPage]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 px-5 py-8 md:px-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px,1fr,340px]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center md:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Document not found</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">The requested document id does not exist in the demo index.</p>
        <Button asChild className="mt-6">
          <Link href="/">Back to search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-5 py-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">DocFinder</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{document.title}</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">Back</Link>
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px,1fr,340px]">
        <Card className="h-fit rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{document.doc_id}</p>
              <p>{document.title}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">{document.doc_type}</Badge>
              <Badge variant="outline">{document.category}</Badge>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p className="inline-flex items-center gap-2">
                <Languages className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                {document.lang}
              </p>
              <p className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                {document.date}
              </p>
              <p className="inline-flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                score {document.score.toFixed(2)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {document.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button asChild variant="accent" className="w-full">
                <a href={document.download_url ?? "#"} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
              <Button asChild variant="secondary" className="w-full">
                <a href={document.open_url ?? "#"} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">PDF preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[560px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Viewer placeholder</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Integrate your preferred PDF viewer here. The panel already receives page context
                  from evidences.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {selectedChunk ? (
                  <>
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      highlighted evidence pag. {selectedChunk.page_start}
                    </p>
                    <div dangerouslySetInnerHTML={{ __html: selectedChunk.snippet_html }} />
                  </>
                ) : (
                  <p>Select an evidence chunk to preview it.</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button asChild variant="secondary">
                  <a href={document.open_url ?? "#"} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Evidencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {document.chunks.map((chunk) => (
              <article
                key={chunk.chunk_id}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{chunk.doc_id}</span>
                  <span>pag. {chunk.page_start}</span>
                </div>
                <div
                  className="text-slate-600 dark:text-slate-300"
                  dangerouslySetInnerHTML={{ __html: chunk.snippet_html }}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedPage(chunk.page_start)}
                  >
                    Ir a página
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
