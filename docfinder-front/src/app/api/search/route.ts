import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  initBackendIndex,
  mapBackendHits,
  searchBackendRaw,
} from "@/server/backend-contract";
import { countDocumentPages } from "@/server/page-counter";
import { listUploadRegistryEntries } from "@/server/upload-registry";
import { cacheHits, getCachedDocumentById } from "@/store/search-cache";
import type { DocumentHit, SearchApiResponse, SortMode } from "@/types/docfinder";

type SearchBody = {
  q?: string;
  page?: number;
  pageSize?: number;
  mode?: "search" | "ask";
  filters?: {
    doc_type?: string[];
    tags?: string[];
    lang?: string[];
    from?: string;
    to?: string;
    sort?: SortMode;
  };
};

const SEARCH_MIN_SCORE = Number(process.env.SEARCH_MIN_SCORE ?? "0.25");

function requiresIndexReinit(details: string[]) {
  return details.some((detail) => {
    const lower = detail.toLowerCase();
    return (
      lower.includes("index_not_found_exception") ||
      lower.includes("not knn_vector type")
    );
  });
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeList(values: string[] | undefined) {
  return (values ?? []).map(normalizeValue);
}

function compareDateAsc(a: string, b: string) {
  const safeA = a || "0000-00-00";
  const safeB = b || "0000-00-00";
  return safeA.localeCompare(safeB);
}

function compareDateDesc(a: string, b: string) {
  const safeA = a || "0000-00-00";
  const safeB = b || "0000-00-00";
  return safeB.localeCompare(safeA);
}

function applyFilters(hits: DocumentHit[], filters: SearchBody["filters"]) {
  const docTypes = normalizeList(filters?.doc_type);
  const langs = normalizeList(filters?.lang);
  const tags = normalizeList(filters?.tags);

  return hits.filter((hit) => {
    const hitDocType = normalizeValue(hit.doc_type);
    const hitLang = normalizeValue(hit.lang);
    const hitTags = hit.tags.map(normalizeValue);

    if (docTypes.length && !docTypes.includes(hitDocType)) {
      return false;
    }
    if (langs.length && !langs.includes(hitLang)) {
      return false;
    }
    if (tags.length && !tags.some((tag) => hitTags.includes(tag))) {
      return false;
    }

    if ((filters?.from || filters?.to) && !hit.date) {
      return false;
    }
    if (filters?.from && hit.date < filters.from) {
      return false;
    }
    if (filters?.to && hit.date > filters.to) {
      return false;
    }
    return true;
  });
}

function buildAvailable(hits: DocumentHit[]) {
  return {
    docTypes: Array.from(new Set(hits.map((hit) => hit.doc_type))).sort(),
    categories: Array.from(new Set(hits.map((hit) => hit.category))).sort(),
    tags: Array.from(new Set(hits.flatMap((hit) => hit.tags))).sort(),
    langs: Array.from(new Set(hits.map((hit) => hit.lang))).sort(),
  };
}

function collapseToDocuments(hits: DocumentHit[]) {
  const byDoc = new Map<string, DocumentHit>();

  for (const hit of hits) {
    const existing = byDoc.get(hit.doc_id);
    if (!existing) {
      byDoc.set(hit.doc_id, {
        ...hit,
        tags: Array.from(new Set(hit.tags)),
      });
      continue;
    }

    const mergedTags = Array.from(new Set([...existing.tags, ...hit.tags]));
    const keepNew =
      hit.score > existing.score ||
      (hit.score === existing.score && hit.date > existing.date);
    const best = keepNew ? hit : existing;

    byDoc.set(hit.doc_id, {
      ...best,
      tags: mergedTags,
    });
  }

  return Array.from(byDoc.values());
}

function sortHits(hits: DocumentHit[], sort: SortMode | undefined) {
  switch (sort) {
    case "relevance_asc":
      return [...hits].sort((a, b) => a.score - b.score || compareDateDesc(a.date, b.date));
    case "date_desc":
      return [...hits].sort((a, b) => compareDateDesc(a.date, b.date) || b.score - a.score);
    case "date_asc":
      return [...hits].sort((a, b) => compareDateAsc(a.date, b.date) || b.score - a.score);
    case "relevance_desc":
    default:
      return [...hits].sort((a, b) => b.score - a.score || compareDateDesc(a.date, b.date));
  }
}

function prettifyTitle(rawName: string, docId: string) {
  const noPrefix = rawName.replace(/^UPL-[A-Z0-9]{8,}-/i, "");
  const base = noPrefix || docId;
  const clean = base.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return clean || docId;
}

async function buildLibraryHits(): Promise<DocumentHit[]> {
  const entries = listUploadRegistryEntries();
  return Promise.all(
    entries.map(async (entry) => {
    const cached = getCachedDocumentById(entry.doc_id);
    const cachedMaxPage = cached?.chunks.reduce((max, chunk) => Math.max(max, chunk.page_end), 0) ?? 0;
    const filePageCount = entry.page_count ?? (await countDocumentPages(entry.saved_path)) ?? 0;
    const totalPages = Math.max(cachedMaxPage, filePageCount, 1);
    const ext = entry.original_name.split(".").pop()?.toLowerCase() || "document";

    return {
      doc_id: entry.doc_id,
      chunk_id: `${entry.doc_id}-library`,
      title: cached?.title ?? prettifyTitle(entry.original_name, entry.doc_id),
      doc_type: cached?.doc_type ?? ext,
      category: cached?.category ?? "uploaded",
      tags: Array.from(new Set([...(cached?.tags ?? []), ...(entry.tags ?? [])])),
      page_start: 1,
      page_end: totalPages,
      lang: cached?.lang ?? "unknown",
      date: cached?.date ?? "",
      score: 0,
      snippet_html: "",
      source_name: entry.original_name,
      source_path: entry.saved_path,
    };
    })
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as SearchBody;
  const page = Math.max(1, body.page ?? 1);
  const pageSize = Math.max(1, Math.min(body.pageSize ?? 8, 24));
  const queryText = body.q?.trim() ?? "";

  if (!queryText) {
    const libraryHits = await buildLibraryHits();
    const sorted = sortHits(applyFilters(libraryHits, body.filters), body.filters?.sort);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = sorted.slice(start, end);

    return NextResponse.json({
      hits: paged,
      total: sorted.length,
      page,
      pageSize,
      hasMore: end < sorted.length,
      available: buildAvailable(libraryHits),
    } satisfies SearchApiResponse);
  }

  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured in frontend." },
      { status: 500 }
    );
  }

  try {
    let backendPayload;
    try {
      backendPayload = await searchBackendRaw(baseUrl, queryText);
    } catch (error) {
      const details = getBackendErrorDetails(error);
      if (!requiresIndexReinit(details)) {
        throw error;
      }
      await initBackendIndex(baseUrl);
      backendPayload = await searchBackendRaw(baseUrl, queryText);
    }
    const mapped = mapBackendHits(backendPayload, queryText);
    const scoreFiltered = mapped.filter(
      (hit) => Number.isFinite(hit.score) && hit.score >= SEARCH_MIN_SCORE
    );
    const documentHitsAll = collapseToDocuments(mapped);
    const documentHitsThreshold = collapseToDocuments(scoreFiltered);
    const baseDocumentHits =
      documentHitsThreshold.length > 0 ? documentHitsThreshold : documentHitsAll;
    const sorted = sortHits(applyFilters(baseDocumentHits, body.filters), body.filters?.sort);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = sorted.slice(start, end);
    // Keep all chunks in cache so document detail can still display evidence.
    cacheHits(mapped);

    return NextResponse.json({
      hits: paged,
      total: sorted.length,
      page,
      pageSize,
      hasMore: end < sorted.length,
      available: buildAvailable(mapped),
    } satisfies SearchApiResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Backend search failed.",
        details: getBackendErrorDetails(error),
      },
      { status: 502 }
    );
  }
}
