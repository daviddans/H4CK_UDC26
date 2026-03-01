"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Download,
  FileText,
  Languages,
  Loader2,
  Plus,
  Tag,
  Trash2,
  BookOpen,
  X,
} from "lucide-react";

import type { DocumentDetail } from "@/types/docfinder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function MetadataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-[96px_1fr] items-start gap-2 border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800/70 ${className ?? ""}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="min-w-0 text-sm text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  );
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

export default function DocumentDetailPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = params.docId;
  const fromContext = searchParams.get("from");
  const includeEvidenceContext = fromContext === "search";
  const pageParam = Number(searchParams.get("page"));
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : null;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [textPreview, setTextPreview] = useState<string>("");
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    async function fetchDocument() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/documents/${docId}?includeEvidence=${includeEvidenceContext ? "1" : "0"}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          if (!disposed) {
            setDocument(null);
            setSelectedPage(null);
          }
          return;
        }

        const payload = (await response.json()) as DocumentDetail;
        if (!disposed) {
          setDocument(payload);
          setSelectedPage(
            includeEvidenceContext
              ? requestedPage ?? payload.chunks[0]?.page_start ?? null
              : null
          );
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");
        if (isAbort) {
          return;
        }
        if (!disposed) {
          setDocument(null);
          setSelectedPage(null);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    if (docId) {
      void fetchDocument();
    } else {
      setLoading(false);
      setDocument(null);
      setSelectedPage(null);
    }

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [docId, includeEvidenceContext, requestedPage]);

  const selectedChunk = useMemo(
    () => document?.chunks.find((chunk) => chunk.page_start === selectedPage),
    [document, selectedPage]
  );
  const hasDownloadUrl = Boolean(document?.download_url);
  const hasOpenUrl = Boolean(document?.open_url);
  const viewerType = document?.viewer_type ?? "binary";
  const canDelete = Boolean(document?.source_path);
  const hasIndexedEvidence = document?.chunks.length ? document.chunks.length > 0 : false;
  const showDocId = document ? !document.doc_id.startsWith("UPL-") : false;
  const canEditTags = Boolean(document?.doc_id.startsWith("UPL-"));
  const normalizedCategory = document?.category?.trim().toLowerCase() ?? "";
  const showCategory = Boolean(document?.category) && !["backend", "indexed"].includes(normalizedCategory);
  const totalPages = document?.total_pages ?? null;
  const viewerOpenUrl = useMemo(() => {
    const openUrl = document?.open_url ?? "";
    if (!openUrl) {
      return "";
    }
    if (viewerType !== "pdf" || !selectedPage || selectedPage < 1) {
      return openUrl;
    }
    return `${openUrl.split("#")[0]}#page=${selectedPage}`;
  }, [document?.open_url, viewerType, selectedPage]);

  const onDelete = async () => {
    if (!document || deleteLoading) {
      return;
    }

    const approved = window.confirm(
      "Delete this local file and metadata? Backend index delete is not available yet."
    );
    if (!approved) {
      return;
    }

    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/documents/${document.doc_id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed");
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
      setDeleteLoading(false);
    }
  };

  const persistTags = async (nextTags: string[]) => {
    if (!document || tagSaving) {
      return;
    }

    setTagSaving(true);
    setTagError(null);
    try {
      const response = await fetch(`/api/documents/${document.doc_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      const payload = (await response.json()) as { error?: string; tags?: string[] };
      if (!response.ok) {
        throw new Error(payload.error ?? "Tag update failed");
      }

      const updatedTags = Array.isArray(payload.tags)
        ? payload.tags.map(normalizeTag).filter(Boolean)
        : nextTags.map(normalizeTag).filter(Boolean);

      setDocument((prev) => (prev ? { ...prev, tags: updatedTags } : prev));
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Tag update failed");
    } finally {
      setTagSaving(false);
    }
  };

  const onAddTag = async () => {
    const normalized = normalizeTag(tagInput);
    if (!normalized || !document) {
      return;
    }
    if (document.tags.includes(normalized)) {
      setTagInput("");
      return;
    }
    await persistTags([...document.tags, normalized]);
    setTagInput("");
  };

  const onRemoveTag = async (tag: string) => {
    if (!document) {
      return;
    }
    await persistTags(document.tags.filter((item) => item !== tag));
  };

  useEffect(() => {
    const openUrl = document?.open_url ?? "";
    if (!openUrl || (viewerType !== "text" && viewerType !== "csv")) {
      setTextPreview("");
      setTextPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    async function fetchTextPreview() {
      setTextPreviewLoading(true);
      try {
        const response = await fetch(openUrl, { signal: controller.signal });
        if (!response.ok) {
          if (!disposed) {
            setTextPreview("Preview unavailable");
          }
          return;
        }
        const raw = await response.text();
        if (!disposed) {
          const maxChars = 14000;
          setTextPreview(raw.slice(0, maxChars));
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");
        if (!isAbort && !disposed) {
          setTextPreview("Preview unavailable");
        }
      } finally {
        if (!disposed) {
          setTextPreviewLoading(false);
        }
      }
    }

    void fetchTextPreview();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [document?.open_url, viewerType]);

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
        <p className="mt-3 text-slate-500 dark:text-slate-400">The requested document id is unavailable in current cache and upload registry.</p>
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

      <section
        className={
          includeEvidenceContext
            ? "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1.05fr),1fr,320px]"
            : "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1fr),1.6fr]"
        }
      >
        <Card className="h-fit rounded-3xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">Metadata</CardTitle>
              {showDocId ? (
                <Badge variant="outline" className="max-w-[170px] truncate">
                  {document.doc_id}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid rounded-2xl border border-slate-200/90 bg-white/70 px-3 dark:border-slate-700 dark:bg-slate-900/70 lg:grid-cols-2 lg:gap-x-4">
              <MetadataRow label="Title" className="lg:col-span-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">{document.title}</p>
              </MetadataRow>
              <MetadataRow label="Type">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="accent">{document.doc_type}</Badge>
                </div>
              </MetadataRow>
              {showCategory ? (
                <MetadataRow label="Category">
                  <Badge variant="outline">{document.category}</Badge>
                </MetadataRow>
              ) : null}
              <MetadataRow label="Language">
                <span className="inline-flex items-center gap-2">
                  <Languages className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {document.lang || "unknown"}
                </span>
              </MetadataRow>
              <MetadataRow label="Date">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {document.date || "unknown"}
                </span>
              </MetadataRow>
              <MetadataRow label="Pages">
                <span className="inline-flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {totalPages ? `${totalPages} pages` : "unknown pages"}
                </span>
              </MetadataRow>
              <MetadataRow label="Score">
                <span className="inline-flex items-center gap-2">
                  <Tag className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {includeEvidenceContext && hasIndexedEvidence
                    ? document.score.toFixed(2)
                    : "N/A"}
                </span>
              </MetadataRow>
              <MetadataRow label="Source">
                <span className="block truncate">{document.source_name ?? "unknown"}</span>
              </MetadataRow>
              {document.source_path ? (
                <MetadataRow label="Path" className="lg:col-span-2">
                  <span
                    className="block break-all text-xs text-slate-500 dark:text-slate-400"
                    title={document.source_path}
                  >
                    {document.source_path}
                  </span>
                </MetadataRow>
              ) : null}
              <MetadataRow label="Tags" className="lg:col-span-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {document.tags.length > 0 ? (
                      document.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs capitalize text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {tag}
                          {canEditTags ? (
                            <button
                              type="button"
                              onClick={() => void onRemoveTag(tag)}
                              className="ml-1 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              disabled={tagSaving}
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          ) : null}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">No tags</span>
                    )}
                  </div>

                  {canEditTags ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void onAddTag();
                          }
                        }}
                        placeholder="Add tag"
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2"
                        onClick={() => void onAddTag()}
                        disabled={tagSaving || !normalizeTag(tagInput)}
                      >
                        {tagSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tag editing is available for uploaded files.
                    </p>
                  )}

                  {tagError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-300">{tagError}</p>
                  ) : null}
                </div>
              </MetadataRow>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {hasDownloadUrl ? (
                <Button asChild variant="accent" className="w-full sm:col-span-2">
                  <a href={document.download_url} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              ) : (
                <Button variant="accent" className="w-full sm:col-span-2" disabled>
                  <Download className="h-4 w-4" />
                  Download unavailable
                </Button>
              )}

              {hasOpenUrl ? (
                <Button asChild variant="secondary" className="w-full">
                  <a href={viewerOpenUrl || document.open_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
                </Button>
              ) : (
                <Button variant="secondary" className="w-full" disabled>
                  <ExternalLink className="h-4 w-4" />
                  Open unavailable
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                onClick={() => void onDelete()}
                disabled={!canDelete || deleteLoading}
              >
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? "Deleting..." : "Delete local file"}
              </Button>
            </div>
            {deleteError ? (
              <p className="text-xs text-rose-600 dark:text-rose-300">{deleteError}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Document preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={previewRef}
              className="flex min-h-[560px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {viewerType === "pdf" ? "PDF Viewer" : "Document Viewer"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {document.source_name ?? "Source file"}
                </p>
              </div>

              {viewerType === "pdf" && hasOpenUrl ? (
                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
                  <iframe
                    src={viewerOpenUrl || document.open_url}
                    title={document.title}
                    className="h-[420px] w-full"
                  />
                </div>
              ) : viewerType === "text" || viewerType === "csv" ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {textPreviewLoading ? (
                    <p>Loading preview...</p>
                  ) : (
                    <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap">{textPreview || "No preview available"}</pre>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {selectedChunk ? (
                    <>
                      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        highlighted evidence pag. {selectedChunk.page_start}
                        {totalPages ? `/${totalPages}` : ""}
                      </p>
                      <div dangerouslySetInnerHTML={{ __html: selectedChunk.snippet_html }} />
                    </>
                  ) : (
                    <p>Select an evidence chunk to preview it.</p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                {hasOpenUrl ? (
                  <Button asChild variant="secondary">
                    <a href={viewerOpenUrl || document.open_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open in new tab
                    </a>
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>
                    <ExternalLink className="h-4 w-4" />
                    Open unavailable
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {includeEvidenceContext ? (
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Evidencias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {document.chunks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No evidence chunks available for this search context.
                </div>
              ) : (
                document.chunks.map((chunk) => (
                  <article
                    key={chunk.chunk_id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{chunk.doc_id.startsWith("UPL-") ? "" : chunk.doc_id}</span>
                      <span>
                        pag. {chunk.page_start}
                        {totalPages ? `/${totalPages}` : ""}
                      </span>
                    </div>
                    <div
                      className="text-slate-600 dark:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: chunk.snippet_html }}
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPage(chunk.page_start);
                          previewRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        Ir a página
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
