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
  Sparkles,
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
import { cn } from "@/lib/utils";

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

function estimateSummaryLines(totalPages: number | null) {
  if (!totalPages || totalPages <= 3) {
    return 1;
  }
  if (totalPages <= 12) {
    return 2;
  }
  return 3;
}

function normalizeSummaryText(value: string, targetLines: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }
  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length >= targetLines) {
    return sentences.slice(0, targetLines).join(" ");
  }
  return compact;
}

function snippetHtmlToText(value: string) {
  return value
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type TextRange = { start: number; end: number };

const MIN_HIGHLIGHT_SIMILARITY = 0.78;

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

function reverseToken(value: string) {
  return [...value].reverse().join("");
}

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function similarityRatio(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) {
    return 1;
  }
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLength;
}

function shouldHighlightWord(wordNorm: string, tokenNorm: string) {
  if (!wordNorm || !tokenNorm) {
    return false;
  }
  if (wordNorm === tokenNorm) {
    return true;
  }

  // For short terms, avoid fuzzy noise.
  if (wordNorm.length <= 3 || tokenNorm.length <= 3) {
    return false;
  }

  // Prevent mirrored matches (e.g. "la" <-> "al", "nova" <-> "avon").
  if (wordNorm === reverseToken(tokenNorm)) {
    return false;
  }

  // Keep fuzzy matching anchored to reduce false positives.
  if (wordNorm[0] !== tokenNorm[0]) {
    return false;
  }

  return similarityRatio(wordNorm, tokenNorm) >= MIN_HIGHLIGHT_SIMILARITY;
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

function collectMatchRanges(text: string, tokens: string[]) {
  const ranges: TextRange[] = [];
  const MAX_RANGES = 180;

  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const rawWord = match[0] ?? "";
    const start = match.index ?? -1;
    if (start < 0 || !rawWord) {
      continue;
    }
    const wordNorm = normalizeToken(rawWord);
    const matches = tokens.some((token) => shouldHighlightWord(wordNorm, token));
    if (!matches) {
      continue;
    }

    ranges.push({ start, end: start + rawWord.length });
    if (ranges.length >= MAX_RANGES) {
      return mergeRanges(ranges);
    }
  }

  return mergeRanges(ranges);
}

function markTextBySeed(text: string, seed: string) {
  const cleanText = text ?? "";
  const tokens = Array.from(
    new Set(
      seed
        .split(/\s+/)
        .map((token) => normalizeToken(token.trim()))
        .filter((token) => token.length > 1)
    )
  ).slice(0, 18);

  if (!tokens.length) {
    return escapeHtml(cleanText);
  }

  const ranges = collectMatchRanges(cleanText, tokens);
  if (!ranges.length) {
    return escapeHtml(cleanText);
  }

  let html = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      html += escapeHtml(cleanText.slice(cursor, range.start));
    }
    html += `<mark>${escapeHtml(cleanText.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  if (cursor < cleanText.length) {
    html += escapeHtml(cleanText.slice(cursor));
  }
  return html;
}

function extractMarkedTerms(snippetHtml: string) {
  const terms = Array.from(snippetHtml.matchAll(/<mark>(.*?)<\/mark>/gi))
    .map((match) => match[1] ?? "")
    .map((item) => item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return terms;
}

function scoreTone(score: number) {
  if (score >= 1) {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (score >= 0.7) {
    return "text-cyan-700 dark:text-cyan-300";
  }
  if (score >= 0.4) {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-slate-600 dark:text-slate-300";
}

export default function DocumentDetailPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = params.docId;
  const fromContext = searchParams.get("from");
  const searchQuery = searchParams.get("q")?.trim() ?? "";
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
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
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

  const rankedEvidence = useMemo(
    () =>
      [...(document?.chunks ?? [])].sort(
        (a, b) =>
          b.score - a.score ||
          a.page_start - b.page_start ||
          a.page_end - b.page_end ||
          a.chunk_id.localeCompare(b.chunk_id)
      ),
    [document?.chunks]
  );
  const evidencePages = useMemo(() => {
    const byPage = new Map<number, number>();
    for (const chunk of rankedEvidence) {
      byPage.set(chunk.page_start, (byPage.get(chunk.page_start) ?? 0) + 1);
    }
    return Array.from(byPage.entries()).sort((a, b) => a[0] - b[0]);
  }, [rankedEvidence]);
  const selectedChunk = useMemo(
    () => rankedEvidence.find((chunk) => chunk.page_start === selectedPage) ?? rankedEvidence[0],
    [rankedEvidence, selectedPage]
  );
  const highlightSeed = useMemo(() => {
    const evidenceTerms = rankedEvidence
      .slice(0, 12)
      .flatMap((chunk) => extractMarkedTerms(chunk.snippet_html));
    if (searchQuery) {
      return searchQuery;
    }
    return evidenceTerms.join(" ");
  }, [rankedEvidence, searchQuery]);
  const textPreviewHtml = useMemo(() => {
    if (!textPreview) {
      return "No preview available";
    }
    return markTextBySeed(textPreview, highlightSeed);
  }, [highlightSeed, textPreview]);
  const hasDownloadUrl = Boolean(document?.download_url);
  const hasOpenUrl = Boolean(document?.open_url);
  const viewerType = document?.viewer_type ?? "binary";
  const canDelete = Boolean(document?.source_path);
  const hasIndexedEvidence = rankedEvidence.length > 0;
  const showDocId = document ? !document.doc_id.startsWith("UPL-") : false;
  const canEditTags = Boolean(document?.doc_id.startsWith("UPL-"));
  const normalizedCategory = document?.category?.trim().toLowerCase() ?? "";
  const showCategory = Boolean(document?.category) && !["backend", "indexed"].includes(normalizedCategory);
  const totalPages = document?.total_pages ?? null;
  const summaryLines = estimateSummaryLines(totalPages);
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

  useEffect(() => {
    setSummaryText(null);
    setSummaryError(null);
    setSummaryLoading(false);
  }, [document?.doc_id]);

  useEffect(() => {
    if (!includeEvidenceContext || selectedPage || rankedEvidence.length === 0) {
      return;
    }
    setSelectedPage(rankedEvidence[0].page_start);
  }, [includeEvidenceContext, rankedEvidence, selectedPage]);

  const onDelete = async () => {
    if (!document || deleteLoading) {
      return;
    }

    const approved = window.confirm("Delete this document?");
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

  const onBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  const onSummarize = async () => {
    if (!document || summaryLoading) {
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const targetLines = estimateSummaryLines(totalPages);
      const contextSeed =
        viewerType === "text" || viewerType === "csv"
          ? textPreview.replace(/\s+/g, " ").trim().slice(0, 2600)
          : "";
      let summaryEvidence = rankedEvidence;
      if (summaryEvidence.length === 0) {
        const evidenceResponse = await fetch(
          `/api/documents/${document.doc_id}?includeEvidence=1`
        );
        if (evidenceResponse.ok) {
          const evidencePayload = (await evidenceResponse.json()) as DocumentDetail;
          summaryEvidence = [...(evidencePayload.chunks ?? [])].sort(
            (a, b) =>
              b.score - a.score ||
              a.page_start - b.page_start ||
              a.page_end - b.page_end ||
              a.chunk_id.localeCompare(b.chunk_id)
          );
        }
      }

      const evidenceText = summaryEvidence
        .slice(0, 8)
        .map((chunk) => snippetHtmlToText(chunk.snippet_html))
        .filter(Boolean)
        .join(" ");
      const context = [contextSeed, evidenceText]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      if (!context) {
        throw new Error("No hay contexto suficiente del documento para generar resumen.");
      }

      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.source_name ?? document.title,
          context,
          lines: targetLines,
        }),
      });
      const payload = (await response.json()) as {
        summary?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Summary request failed");
      }

      const answer = normalizeSummaryText(payload.summary ?? "", targetLines);
      if (!answer) {
        throw new Error("No summary generated.");
      }
      setSummaryText(answer);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Summary request failed");
    } finally {
      setSummaryLoading(false);
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
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">GandalFS &lt;&gt;</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{document.title}</h1>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back
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
                {deleteLoading ? "Deleting..." : "Delete"}
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {document.source_name ?? "Source file"}
              </p>

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
                    <pre
                      className="max-h-[360px] overflow-auto whitespace-pre-wrap [&_mark]:rounded-sm [&_mark]:bg-cyan-100 [&_mark]:px-0.5 [&_mark]:text-slate-900 dark:[&_mark]:bg-cyan-500/35 dark:[&_mark]:text-slate-50"
                      dangerouslySetInnerHTML={{ __html: textPreviewHtml }}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {selectedChunk ? (
                    <>
                      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        evidence focus pag. {selectedChunk.page_start}
                        {totalPages ? `/${totalPages}` : ""}
                        {` · score ${selectedChunk.score.toFixed(2)}`}
                      </p>
                      <div dangerouslySetInnerHTML={{ __html: selectedChunk.snippet_html }} />
                    </>
                  ) : (
                    <p>Select an evidence chunk to preview it.</p>
                  )}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">
                    Summary
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onSummarize()}
                    disabled={summaryLoading}
                  >
                    {summaryLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Summarizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Summarize ({summaryLines} line{summaryLines > 1 ? "s" : ""})
                      </>
                    )}
                  </Button>
                </div>

                {summaryText ? (
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{summaryText}</p>
                ) : summaryError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-300">{summaryError}</p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generate a short summary of this document.
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-center border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
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
              {rankedEvidence.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No evidence chunks available for this search context.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span>Ordered by relevance</span>
                      <span>
                        {rankedEvidence.length} chunks · {evidencePages.length} pages
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {evidencePages.map(([page, count]) => (
                        <button
                          key={`evidence-page-${page}`}
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            selectedPage === page
                              ? "border-cyan-500 bg-cyan-500 text-white dark:border-cyan-400 dark:bg-cyan-400 dark:text-slate-900"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          )}
                          onClick={() => setSelectedPage(page)}
                        >
                          <span>
                            p.{page}
                            {totalPages ? `/${totalPages}` : ""}
                          </span>
                          <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold dark:bg-white/10">
                            {count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {rankedEvidence.map((chunk, index) => {
                    const isActive = selectedPage === chunk.page_start;
                    return (
                      <article
                        key={chunk.chunk_id}
                        className={cn(
                          "rounded-2xl border bg-white p-3 text-sm transition dark:bg-slate-900",
                          isActive
                            ? "border-cyan-300 shadow-[0_0_0_1px_rgba(14,165,233,0.2)] dark:border-cyan-500/60"
                            : "border-slate-200 dark:border-slate-700"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <span className={cn("font-semibold", scoreTone(chunk.score))}>
                              score {chunk.score.toFixed(2)}
                            </span>
                          </div>
                          <span>
                            pag. {chunk.page_start}
                            {totalPages ? `/${totalPages}` : ""}
                          </span>
                        </div>
                        <div
                          className="line-clamp-4 text-slate-600 dark:text-slate-300"
                          dangerouslySetInnerHTML={{ __html: chunk.snippet_html }}
                        />
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "ghost"}
                            onClick={() => {
                              setSelectedPage(chunk.page_start);
                              previewRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }}
                          >
                            Ir a documento
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
