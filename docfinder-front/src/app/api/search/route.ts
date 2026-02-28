import { NextResponse } from "next/server";

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

type BackendResponse = {
  hits?: {
    hits?: Array<{
      _score?: number;
      _source?: {
        content?: string;
        metadata?: {
          source?: string;
          chunk_id?: number | string;
        };
      };
    }>;
  };
};

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
    snippet = snippet.replace(
      new RegExp(`(${escapeRegExp(token)})`, "gi"),
      "<mark>$1</mark>"
    );
  }

  const prefix = from > 0 ? "..." : "";
  const suffix = from + 260 < clean.length ? "..." : "";
  return `${prefix}${snippet}${suffix}`;
}

function mapBackendHits(payload: BackendResponse, queryText: string): DocumentHit[] {
  const rawHits = payload.hits?.hits ?? [];
  const now = new Date().toISOString().slice(0, 10);

  return rawHits.map((hit, index) => {
    const sourceName = hit._source?.metadata?.source ?? `document-${index + 1}.txt`;
    const chunkRaw = hit._source?.metadata?.chunk_id ?? index;
    const chunkId = Number(chunkRaw) || index;
    const content = hit._source?.content ?? "";
    const docId = makeDocId(sourceName);

    return {
      doc_id: docId,
      chunk_id: `${docId}-${chunkId}`,
      title: formatTitle(sourceName),
      doc_type: sourceName.split(".").pop()?.toLowerCase() || "document",
      category: "backend",
      tags: ["indexed", "opensearch"],
      page_start: chunkId + 1,
      page_end: chunkId + 1,
      lang: "unknown",
      date: now,
      score: Number(hit._score ?? 0),
      snippet_html: makeSnippet(content, queryText),
    };
  });
}

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

  const backendAttempts = [
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
          errors.push(`${path} ${response.status}: ${text.slice(0, 200)}`);
          continue;
        }

        const backendPayload = (await response.json()) as BackendResponse;
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
        errors.push(error instanceof Error ? error.message : "Network error");
      }
    }
  }

  return NextResponse.json(
    {
      error: "Backend search failed.",
      details: errors,
    },
    { status: 502 }
  );
}
