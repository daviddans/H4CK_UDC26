import path from "node:path";

import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  initBackendIndex,
  mapBackendHits,
  searchBackendRaw,
} from "@/server/backend-contract";
import { getUploadRegistryEntryBySource } from "@/server/upload-registry";
import type { AskResponse, DocumentHit } from "@/types/docfinder";

type BackendAskResponse = {
  answer?: string;
  sources?: Array<{
    file?: string;
    chunk?: number;
  }>;
  citations?: Array<{
    doc_id?: string;
    title?: string;
    page?: number;
    snippet_html?: string;
    doc_type?: string;
    source_name?: string;
  }>;
};

type AskProbeResult = {
  response: AskResponse | null;
  errors: string[];
};

const BACKEND_ASK_TIMEOUT_MS = 60_000;
const ASK_MIN_SCORE = Number(process.env.SEARCH_MIN_SCORE ?? "0.25");

function requiresIndexReinit(details: string[]) {
  return details.some((detail) => {
    const lower = detail.toLowerCase();
    return (
      lower.includes("index_not_found_exception") ||
      lower.includes("not knn_vector type")
    );
  });
}

function normalizeSourceName(value: string) {
  const normalized = path.basename(value.trim().replaceAll("\\", "/"));
  return normalized || value.trim();
}

function stripUploadPrefix(filename: string) {
  return filename.replace(/^UPL-[A-Z0-9]{8,}-/i, "");
}

function detectDocType(name: string, fallback = "document") {
  const base = name.trim().replaceAll("\\", "/").split("/").pop() ?? name.trim();
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() : "";
  return ext || fallback;
}

function toPositivePage(value: number | undefined, fallback = 1) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value as number));
}

function findEntryBySource(sourceValue: string) {
  const normalized = normalizeSourceName(sourceValue);
  const withoutPrefix = stripUploadPrefix(normalized);
  return (
    getUploadRegistryEntryBySource(sourceValue) ??
    getUploadRegistryEntryBySource(normalized) ??
    getUploadRegistryEntryBySource(withoutPrefix)
  );
}

function mapSourceToCitation(
  source: NonNullable<BackendAskResponse["sources"]>[number]
): AskResponse["citations"][number] {
  const rawFile = source.file?.trim() || "Document";
  const matchedEntry = findEntryBySource(rawFile);
  const sourceName =
    matchedEntry?.original_name ?? stripUploadPrefix(normalizeSourceName(rawFile));
  const page = toPositivePage(
    Number.isFinite(Number(source.chunk)) ? Number(source.chunk) + 1 : undefined,
    1
  );

  return {
    doc_id: matchedEntry?.doc_id ?? "unknown",
    title: sourceName || "Document",
    page,
    snippet_html: "",
    doc_type: detectDocType(sourceName || rawFile),
    source_name: sourceName || rawFile,
  };
}

function mapCitation(
  citation: NonNullable<BackendAskResponse["citations"]>[number]
): AskResponse["citations"][number] {
  const sourceCandidate = citation.source_name?.trim() || citation.title?.trim() || "";
  const matchedEntry = sourceCandidate ? findEntryBySource(sourceCandidate) : null;
  const sourceName =
    matchedEntry?.original_name ||
    stripUploadPrefix(normalizeSourceName(sourceCandidate || "Document"));
  const page = toPositivePage(citation.page, 1);

  return {
    doc_id:
      citation.doc_id && citation.doc_id !== "unknown"
        ? citation.doc_id
        : matchedEntry?.doc_id ?? "unknown",
    title: citation.title?.trim() || sourceName || "Document",
    page,
    snippet_html: citation.snippet_html ?? "",
    doc_type: citation.doc_type ?? detectDocType(sourceName || sourceCandidate || "document"),
    source_name: sourceName || undefined,
  };
}

function uniqueCitations(citations: AskResponse["citations"]): AskResponse["citations"] {
  const seen = new Set<string>();
  const output: AskResponse["citations"] = [];
  for (const citation of citations) {
    const key = `${citation.doc_id}|${citation.page}|${citation.source_name ?? citation.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(citation);
  }
  return output;
}

function collapseToDocumentHits(hits: DocumentHit[]) {
  const byDoc = new Map<string, DocumentHit>();

  for (const hit of hits) {
    const current = byDoc.get(hit.doc_id);
    if (!current) {
      byDoc.set(hit.doc_id, hit);
      continue;
    }
    if (hit.score > current.score || (hit.score === current.score && hit.page_start < current.page_start)) {
      byDoc.set(hit.doc_id, hit);
    }
  }

  return Array.from(byDoc.values()).sort((a, b) => b.score - a.score);
}

function buildSearchCitations(hits: DocumentHit[]): AskResponse["citations"] {
  if (!hits.length) {
    return [];
  }

  const collapsed = collapseToDocumentHits(hits);
  const aboveThreshold = collapsed.filter(
    (hit) => Number.isFinite(hit.score) && hit.score >= ASK_MIN_SCORE
  );
  const selected = aboveThreshold.length > 0 ? aboveThreshold : collapsed;

  return selected.map((hit) => ({
    doc_id: hit.doc_id,
    title: hit.title,
    page: Math.max(1, hit.page_start),
    snippet_html: hit.snippet_html ?? "",
    doc_type: hit.doc_type,
    source_name: hit.source_name,
  }));
}

async function loadAskSearchHits(baseUrl: string, question: string): Promise<DocumentHit[]> {
  try {
    let rawPayload;
    try {
      rawPayload = await searchBackendRaw(baseUrl, question);
    } catch (error) {
      const details = getBackendErrorDetails(error);
      if (!requiresIndexReinit(details)) {
        return [];
      }
      await initBackendIndex(baseUrl);
      rawPayload = await searchBackendRaw(baseUrl, question);
    }

    return mapBackendHits(rawPayload, question).sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function tryBackendAsk(baseUrl: string, question: string): Promise<AskProbeResult> {
  const errors: string[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_ASK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: question }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      errors.push(`/ask -> ${response.status}: ${message.slice(0, 240)}`);
      return { response: null, errors };
    }

    const data = (await response.json()) as BackendAskResponse;
    if (typeof data.answer !== "string") {
      errors.push("/ask -> 200 but unknown payload shape");
      return { response: null, errors };
    }

    const mappedCitations = Array.isArray(data.citations)
      ? data.citations.map(mapCitation)
      : [];
    const mappedSources =
      mappedCitations.length === 0 && Array.isArray(data.sources)
        ? data.sources.map(mapSourceToCitation)
        : [];

    return {
      response: {
        answer: data.answer,
        citations: uniqueCitations(mappedCitations.length > 0 ? mappedCitations : mappedSources),
      },
      errors,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      errors.push(`/ask -> timeout after ${BACKEND_ASK_TIMEOUT_MS / 1000}s`);
    } else {
      errors.push(`/ask -> ${error instanceof Error ? error.message : "Network error"}`);
    }
    return { response: null, errors };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { question?: string };
  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured in frontend." },
      { status: 500 }
    );
  }

  const backendAsk = await tryBackendAsk(baseUrl, question);
  const searchHits = await loadAskSearchHits(baseUrl, question);
  const searchCitations = buildSearchCitations(searchHits);

  if (!backendAsk.response) {
    return NextResponse.json(
      {
        error: "Backend LLM ask failed.",
        details: backendAsk.errors,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      answer: backendAsk.response.answer,
      citations: uniqueCitations([
        ...(backendAsk.response.citations ?? []),
        ...searchCitations,
      ]),
    } satisfies AskResponse
  );
}
