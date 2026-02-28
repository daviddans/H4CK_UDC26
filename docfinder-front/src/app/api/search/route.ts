import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  mapBackendHits,
  searchBackendRaw,
} from "@/server/backend-contract";
import { cacheHits } from "@/store/search-cache";
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

function applyFilters(hits: DocumentHit[], filters: SearchBody["filters"]) {
  return hits.filter((hit) => {
    if (filters?.doc_type?.length && !filters.doc_type.includes(hit.doc_type)) {
      return false;
    }
    if (filters?.lang?.length && !filters.lang.includes(hit.lang)) {
      return false;
    }
    if (filters?.tags?.length && !filters.tags.every((tag) => hit.tags.includes(tag))) {
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

function sortHits(hits: DocumentHit[], sort: SortMode | undefined) {
  switch (sort) {
    case "relevance_asc":
      return [...hits].sort((a, b) => a.score - b.score || b.date.localeCompare(a.date));
    case "date_desc":
      return [...hits].sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);
    case "date_asc":
      return [...hits].sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);
    case "relevance_desc":
    default:
      return [...hits].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as SearchBody;
  const page = Math.max(1, body.page ?? 1);
  const pageSize = Math.max(1, Math.min(body.pageSize ?? 8, 24));
  const queryText = body.q?.trim() ?? "";

  if (!queryText) {
    return NextResponse.json({
      hits: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
      available: { docTypes: [], categories: [], tags: [], langs: [] },
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
    const backendPayload = await searchBackendRaw(baseUrl, queryText);
    const mapped = mapBackendHits(backendPayload, queryText);
    const sorted = sortHits(applyFilters(mapped, body.filters), body.filters?.sort);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = sorted.slice(start, end);
    cacheHits(paged);

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
