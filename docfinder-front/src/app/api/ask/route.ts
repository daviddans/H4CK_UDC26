import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  mapBackendHits,
  searchBackendRaw,
  snippetToText,
} from "@/server/backend-contract";
import { cacheHits } from "@/store/search-cache";
import type { AskResponse } from "@/types/docfinder";
import type { DocumentHit } from "@/types/docfinder";

type BackendAskResponse =
  | {
      answer?: string;
      citations?: Array<{
        doc_id?: string;
        title?: string;
        page?: number;
        snippet_html?: string;
      }>;
    }
  | {
      response?: string;
    };

type AskProbeResult = {
  response: AskResponse | null;
  unavailable: boolean;
  errors: string[];
};

const BACKEND_ASK_TIMEOUT_MS = 60_000;
const ASK_MIN_SCORE = Number(process.env.SEARCH_MIN_SCORE ?? "0.25");

type SearchContextResult = {
  hits: DocumentHit[];
  errors: string[];
};

async function tryBackendAsk(baseUrl: string, question: string): Promise<AskProbeResult> {
  const askEndpoints = ["/ask", "/ask_ai"];
  const errors: string[] = [];
  let foundEndpoint = false;

  for (const endpoint of askEndpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_ASK_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, search_text: question }),
        signal: controller.signal,
      });

      if (response.status === 404 || response.status === 405) {
        continue;
      }
      foundEndpoint = true;
      if (!response.ok) {
        const message = await response.text();
        errors.push(`${endpoint} -> ${response.status}: ${message.slice(0, 240)}`);
        continue;
      }

      const data = (await response.json()) as BackendAskResponse;
      if ("answer" in data && typeof data.answer === "string") {
        return {
          response: {
            answer: data.answer,
            citations: (data.citations ?? []).map((citation) => ({
              doc_id: citation.doc_id ?? "unknown",
              title: citation.title ?? "Document",
              page: Number(citation.page ?? 1),
              snippet_html: citation.snippet_html ?? "",
            })),
          },
          unavailable: false,
          errors,
        };
      }

      if ("response" in data && typeof data.response === "string") {
        return {
          response: {
            answer: data.response,
            citations: [],
          },
          unavailable: false,
          errors,
        };
      }

      errors.push(`${endpoint} -> 200 but unknown payload shape`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        errors.push(`${endpoint} -> timeout after ${BACKEND_ASK_TIMEOUT_MS / 1000}s`);
      } else {
        errors.push(`${endpoint} -> network error`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    response: null,
    unavailable: !foundEndpoint,
    errors,
  };
}

function buildAnswerFromHits(question: string, snippets: string[]): string {
  if (!snippets.length) {
    return `No encontré evidencia suficiente en el índice para responder: "${question}".`;
  }

  const topSnippets = snippets.slice(0, 3).join(" ");
  return `Basado en los fragmentos recuperados: ${topSnippets}`;
}

async function loadSearchContext(baseUrl: string, question: string): Promise<SearchContextResult> {
  try {
    const rawSearch = await searchBackendRaw(baseUrl, question);
    const mapped = mapBackendHits(rawSearch, question);
    cacheHits(mapped);
    return {
      hits: mapped.sort((a, b) => b.score - a.score),
      errors: [],
    };
  } catch (error) {
    return {
      hits: [],
      errors: getBackendErrorDetails(error),
    };
  }
}

function mapCitationsToKnownDocs(
  citations: AskResponse["citations"],
  rankedHits: DocumentHit[]
): AskResponse["citations"] {
  if (rankedHits.length === 0) {
    return citations;
  }

  return citations.map((citation, index) => {
    const byDocAndPage = rankedHits.find(
      (hit) => hit.doc_id === citation.doc_id && hit.page_start === citation.page
    );
    const byDoc = rankedHits.find((hit) => hit.doc_id === citation.doc_id);
    const byTitle = rankedHits.find(
      (hit) => hit.title.trim().toLowerCase() === citation.title.trim().toLowerCase()
    );
    const byPage = rankedHits.find((hit) => hit.page_start === citation.page);
    const fallback = rankedHits[index] ?? rankedHits[0];
    const matched = byDocAndPage ?? byDoc ?? byTitle ?? byPage ?? fallback;

    if (!matched) {
      return citation;
    }

    return {
      doc_id: matched.doc_id,
      title: matched.title,
      page: Number.isFinite(citation.page) && citation.page > 0 ? citation.page : matched.page_start,
      snippet_html: citation.snippet_html || matched.snippet_html,
    };
  });
}

function uniqueCitations(citations: AskResponse["citations"]): AskResponse["citations"] {
  const seen = new Set<string>();
  const output: AskResponse["citations"] = [];
  for (const citation of citations) {
    const key = `${citation.doc_id}|${citation.page}|${citation.snippet_html}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(citation);
  }
  return output;
}

function pickDiverseCitationsFromHits(hits: DocumentHit[], limit = 6): AskResponse["citations"] {
  const byDoc = new Map<string, DocumentHit>();
  for (const hit of hits) {
    if (!byDoc.has(hit.doc_id)) {
      byDoc.set(hit.doc_id, hit);
    }
    if (byDoc.size >= limit) {
      break;
    }
  }

  return Array.from(byDoc.values()).map((hit) => ({
    doc_id: hit.doc_id,
    title: hit.title,
    page: hit.page_start,
    snippet_html: hit.snippet_html,
  }));
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
  const searchContext = await loadSearchContext(baseUrl, question);
  const thresholdHits = searchContext.hits.filter(
    (hit) => Number.isFinite(hit.score) && hit.score >= ASK_MIN_SCORE
  );
  const rankedHits =
    thresholdHits.length > 0 ? thresholdHits : searchContext.hits;

  if (backendAsk.response) {
    const normalizedCitations = uniqueCitations(
      mapCitationsToKnownDocs(
      backendAsk.response.citations ?? [],
      searchContext.hits
      )
    );
    const citations =
      normalizedCitations.length > 0
        ? normalizedCitations
        : pickDiverseCitationsFromHits(rankedHits, 6);

    return NextResponse.json({
      answer: backendAsk.response.answer,
      citations,
    } satisfies AskResponse);
  }

  try {
    const hits = rankedHits.slice(0, 6);
    const citations = pickDiverseCitationsFromHits(rankedHits, 6);

    const answer = buildAnswerFromHits(
      question,
      hits.map((hit) => snippetToText(hit.snippet_html)).filter(Boolean)
    );

    return NextResponse.json({
      answer,
      citations,
    } satisfies AskResponse);
  } catch (error) {
    if (!backendAsk.unavailable) {
      return NextResponse.json(
        {
          error: "Backend LLM ask failed and fallback search is unavailable.",
          details: [...backendAsk.errors, ...getBackendErrorDetails(error)],
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Ask failed because backend search is unavailable.",
        details: [...searchContext.errors, ...getBackendErrorDetails(error)],
      },
      { status: 502 }
    );
  }
}
