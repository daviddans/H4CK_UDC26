import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  mapBackendHits,
  searchBackendRaw,
} from "@/server/backend-contract";
import { cacheHits } from "@/store/search-cache";
import type { DocumentHit, SearchApiResponse } from "@/types/docfinder";

type SearchBody = {
  q?: string;
  page?: number;
  pageSize?: number;
  mode?: "search" | "ask";
  filters?: {
    doc_type?: string[];
    category?: string[];
    tags?: string[];
    lang?: string[];
    from?: string;
    to?: string;
    sort?: "relevance" | "date";
  };
};

function applyFilters(hits: DocumentHit[], filters: SearchBody["filters"]) {
  return hits.filter((hit) => {
    if (filters?.doc_type?.length && !filters.doc_type.includes(hit.doc_type)) {
      return false;
    }
    if (filters?.category?.length && !filters.category.includes(hit.category)) {
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
    const sorted = applyFilters(mapped, body.filters).sort((a, b) =>
      body.filters?.sort === "date" ? b.date.localeCompare(a.date) : b.score - a.score
    );

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
