import type { DocumentHit } from "@/types/docfinder";
import { getUploadRegistryEntryBySource } from "@/server/upload-registry";

type BackendSourceMetadata = {
  source?: string;
  chunk_id?: number | string;
  doc_id?: string;
  title?: string;
  doc_type?: string;
  category?: string;
  tags?: string[] | string;
  lang?: string;
  date?: string;
  page_start?: number | string;
  page_end?: number | string;
};

type BackendRawHit = {
  _score?: number;
  _source?: {
    content?: string;
    metadata?: BackendSourceMetadata;
  };
};

export type BackendSearchResponse = {
  hits?: {
    hits?: BackendRawHit[];
  };
};

type SearchPayloadVariants = {
  querry?: string;
  query?: string;
  q?: string;
};

function asStringList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toNumber(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTitle(source: string) {
  const base = source.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  if (!base) {
    return "Indexed Document";
  }
  return base.replace(/\b\w/g, (char) => char.toUpperCase());
}

function makeDocId(source: string) {
  const slug = source
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `BACK-${slug || "document"}`;
}

function makeSnippet(content: string, queryText: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "<span>No snippet available</span>";
  }

  const lowered = clean.toLowerCase();
  const tokens = Array.from(
    new Set(
      queryText
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1)
    )
  );

  let from = 0;
  const firstIdx = tokens
    .map((token) => lowered.indexOf(token))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];
  if (typeof firstIdx === "number") {
    from = Math.max(0, firstIdx - 80);
  }

  let snippet = escapeHtml(clean.slice(from, from + 260));
  for (const token of tokens) {
    snippet = snippet.replace(new RegExp(`(${escapeRegExp(token)})`, "gi"), "<mark>$1</mark>");
  }

  const prefix = from > 0 ? "..." : "";
  const suffix = from + 260 < clean.length ? "..." : "";
  return `${prefix}${snippet}${suffix}`;
}

export async function searchBackendRaw(baseUrl: string, queryText: string): Promise<BackendSearchResponse> {
  const backendAttempts: SearchPayloadVariants[] = [
    { querry: queryText },
    { query: queryText },
    { q: queryText },
  ];
  const backendPaths = ["/search", "/search%20"];
  const errors: string[] = [];

  for (const path of backendPaths) {
    for (const payload of backendAttempts) {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          errors.push(`${path} payload=${JSON.stringify(payload)} -> ${response.status}: ${text.slice(0, 240)}`);
          continue;
        }

        return (await response.json()) as BackendSearchResponse;
      } catch (error) {
        errors.push(
          `${path} payload=${JSON.stringify(payload)} -> ${error instanceof Error ? error.message : "Network error"}`
        );
      }
    }
  }

  const err = new Error("Backend search failed.");
  (err as Error & { details?: string[] }).details = errors;
  throw err;
}

export function getBackendErrorDetails(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return [];
  }
  if (!("details" in error)) {
    return [];
  }
  const details = (error as { details?: unknown }).details;
  return Array.isArray(details) ? details.map((value) => String(value)) : [];
}

export function mapBackendHits(payload: BackendSearchResponse, queryText: string): DocumentHit[] {
  const rawHits = payload.hits?.hits ?? [];
  const now = new Date().toISOString().slice(0, 10);

  return rawHits.map((hit, index) => {
    const metadata = hit._source?.metadata ?? {};
    const sourceName = metadata.source ?? `document-${index + 1}.txt`;
    const uploadMeta = getUploadRegistryEntryBySource(sourceName);
    const chunkRaw = metadata.chunk_id ?? index;
    const chunkId = toNumber(chunkRaw, index);
    const content = hit._source?.content ?? "";
    const docId = metadata.doc_id ?? uploadMeta?.doc_id ?? makeDocId(sourceName);
    const title =
      metadata.title ?? (uploadMeta?.original_name ? formatTitle(uploadMeta.original_name) : formatTitle(sourceName));
    const tags = asStringList(metadata.tags);
    const mergedTags = tags.length ? tags : uploadMeta?.tags ?? [];
    const pageStart = toNumber(metadata.page_start, chunkId + 1);
    const pageEnd = toNumber(metadata.page_end, pageStart);
    const detectedType = sourceName.split(".").pop()?.toLowerCase() || "document";
    const dateFromUpload = uploadMeta?.uploaded_at?.slice(0, 10);

    return {
      doc_id: docId,
      chunk_id: `${docId}-${chunkId}`,
      title,
      doc_type: metadata.doc_type ?? uploadMeta?.doc_type ?? detectedType,
      category: metadata.category ?? uploadMeta?.category ?? "backend",
      tags: mergedTags.length ? mergedTags : ["indexed"],
      page_start: pageStart,
      page_end: pageEnd,
      lang: metadata.lang ?? uploadMeta?.lang ?? "unknown",
      date: metadata.date ?? dateFromUpload ?? now,
      score: Number(hit._score ?? 0),
      snippet_html: makeSnippet(content, queryText),
    };
  });
}

export function snippetToText(snippetHtml: string): string {
  return snippetHtml
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
