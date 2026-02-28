import { NextRequest, NextResponse } from "next/server";

import { buildSearchResponse, normalizeBackendSearchResponse } from "@/lib/backend-search";
import { searchMock } from "@/lib/mock-data";
import { SearchFilters } from "@/lib/types";

const parseList = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const getBackendBaseUrl = () => process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

const resolveSearchUrls = (baseUrl: string) => {
  const clean = baseUrl.replace(/\/$/, "");
  return [`${clean}/search`, `${clean}/search%20`];
};

const getFilters = (request: NextRequest): SearchFilters => {
  const { searchParams } = request.nextUrl;

  return {
    q: searchParams.get("q") ?? "",
    doc_type: parseList(searchParams.get("doc_type")),
    category: parseList(searchParams.get("category")),
    tags: parseList(searchParams.get("tags")),
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
    lang: searchParams.get("lang") ?? "all",
    order: searchParams.get("order") === "date" ? "date" : "relevance",
    page: Number(searchParams.get("page") ?? "1"),
    limit: Number(searchParams.get("limit") ?? "6"),
  };
};

async function tryBackendSearch(filters: SearchFilters) {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const query = filters.q?.trim();
  if (!query) {
    return [];
  }

  const urls = resolveSearchUrls(baseUrl);
  let lastError = "backend unavailable";

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: query }),
        cache: "no-store",
      });

      if (!response.ok) {
        lastError = `backend status ${response.status}`;
        continue;
      }

      const payload = (await response.json().catch(() => null)) as unknown;
      return normalizeBackendSearchResponse(payload, query);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
  }

  throw new Error(lastError);
}

export async function GET(request: NextRequest) {
  const filters = getFilters(request);

  try {
    const backendHits = await tryBackendSearch(filters);

    if (backendHits && backendHits.length > 0) {
      return NextResponse.json({ ...buildSearchResponse(backendHits, filters), source: "backend" });
    }

    if (backendHits && backendHits.length === 0 && filters.q?.trim()) {
      return NextResponse.json({ ...buildSearchResponse([], filters), source: "backend" });
    }
  } catch (error) {
    const warning = error instanceof Error ? error.message : "backend search error";
    return NextResponse.json({ ...searchMock(filters), source: "mock", warning });
  }

  return NextResponse.json({
    ...searchMock(filters),
    source: "mock",
    warning: getBackendBaseUrl()
      ? "Backend activo pero sin respuesta parseable: usando mock"
      : "BACKEND_URL no configurado: usando mock",
  });
}
