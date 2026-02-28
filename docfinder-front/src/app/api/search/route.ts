import { NextResponse } from "next/server";

import { runMockSearch } from "@/lib/mock-data";
import type { DocumentHit, SearchApiResponse } from "@/types/docfinder";

type BackendSearchResponse =
  | DocumentHit[]
  | {
      hits?: DocumentHit[];
      results?: DocumentHit[];
      data?: DocumentHit[];
    };

function normalizeBackendResponse(payload: BackendSearchResponse): SearchApiResponse | null {
  const extracted = Array.isArray(payload)
    ? payload
    : payload.hits ?? payload.results ?? payload.data ?? [];

  if (!Array.isArray(extracted) || !extracted.length) {
    return null;
  }

  const validHits = extracted.filter(
    (hit): hit is DocumentHit =>
      typeof hit?.doc_id === "string" &&
      typeof hit?.chunk_id === "string" &&
      typeof hit?.title === "string" &&
      typeof hit?.snippet_html === "string"
  );

  if (!validHits.length) {
    return null;
  }

  return {
    hits: validHits,
    total: validHits.length,
    page: 1,
    pageSize: validHits.length,
    hasMore: false,
    available: {
      docTypes: Array.from(new Set(validHits.map((hit) => hit.doc_type))).sort(),
      categories: Array.from(new Set(validHits.map((hit) => hit.category))).sort(),
      tags: Array.from(new Set(validHits.flatMap((hit) => hit.tags))).sort(),
      langs: Array.from(new Set(validHits.map((hit) => hit.lang))).sort(),
    },
  };
}

async function tryBackendSearch(body: Record<string, unknown>) {
  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return null;
  }

  const candidates = ["/search", "/search%20"];

  for (const path of candidates) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as BackendSearchResponse;
      const normalized = normalizeBackendResponse(payload);
      if (normalized) {
        return normalized;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
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

  const backendPayload = {
    query: body.q ?? "",
    filters: body.filters ?? {},
    page: body.page ?? 1,
    pageSize: body.pageSize ?? 8,
  };

  const backend = await tryBackendSearch(backendPayload);
  if (backend) {
    return NextResponse.json(backend);
  }

  await new Promise((resolve) => setTimeout(resolve, 380));
  const response = runMockSearch(body);
  return NextResponse.json(response);
}
