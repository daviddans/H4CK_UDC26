import path from "node:path";

import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  initBackendIndex,
  mapBackendHits,
  searchBackendRaw,
} from "@/server/backend-contract";
import { cacheHits } from "@/store/search-cache";
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

type SearchContextResult = {
  hits: DocumentHit[];
  errors: string[];
};

type AskModelResult = {
  answer: string | null;
  error: string | null;
};

const BACKEND_ASK_TIMEOUT_MS = 60_000;
const ASK_MIN_SCORE = Number(process.env.SEARCH_MIN_SCORE ?? "0.25");
const OLLAMA_URL = process.env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b-instruct";
const OLLAMA_ASK_TIMEOUT_MS = 45_000;

function requiresIndexReinit(details: string[]) {
  return details.some((detail) => {
    const lower = detail.toLowerCase();
    return (
      lower.includes("index_not_found_exception") ||
      lower.includes("not knn_vector type")
    );
  });
}

function normalizeSourceKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replaceAll("\\", "/")
      .split("/")
      .pop()
      ?.replace(/^upl-[a-z0-9]{8}-/i, "")
      .replace(/\.[a-z0-9]+$/i, "") ?? ""
  );
}

function detectDocType(name: string, fallback = "document") {
  const base =
    name.trim().replaceAll("\\", "/").split("/").pop() ?? name.trim();
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() : "";
  return ext || fallback;
}

function looksLikeNoContextAnswer(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.includes("no se encontró contexto suficiente") ||
    normalized.includes("no se encontro contexto suficiente") ||
    normalized.includes("no encontré contexto suficiente") ||
    normalized.includes("no encontre contexto suficiente") ||
    normalized.includes("sin contexto suficiente") ||
    normalized.includes("no context") ||
    normalized.includes("insufficient context")
  );
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
    doc_type: hit.doc_type,
    source_name: hit.source_name,
  }));
}

function mapCitationsToKnownDocs(
  citations: AskResponse["citations"],
  rankedHits: DocumentHit[]
): AskResponse["citations"] {
  if (rankedHits.length === 0) {
    return citations;
  }

  return citations.map((citation, index) => {
    const sourceKey = normalizeSourceKey(citation.title);
    const bySource = rankedHits.find(
      (hit) =>
        normalizeSourceKey(hit.source_name ?? "") === sourceKey ||
        normalizeSourceKey(hit.title) === sourceKey
    );
    const byDocAndPage = rankedHits.find(
      (hit) => hit.doc_id === citation.doc_id && hit.page_start === citation.page
    );
    const byDoc = rankedHits.find((hit) => hit.doc_id === citation.doc_id);
    const byTitle = rankedHits.find(
      (hit) => hit.title.trim().toLowerCase() === citation.title.trim().toLowerCase()
    );
    const byPage = rankedHits.find((hit) => hit.page_start === citation.page);
    const fallback = rankedHits[index] ?? rankedHits[0];
    const matched = bySource ?? byDocAndPage ?? byDoc ?? byTitle ?? byPage ?? fallback;

    if (!matched) {
      return citation;
    }

    return {
      doc_id: matched.doc_id,
      title: matched.title,
      page:
        Number.isFinite(citation.page) && citation.page > 0
          ? citation.page
          : matched.page_start,
      snippet_html: citation.snippet_html || matched.snippet_html,
      doc_type: matched.doc_type,
      source_name: matched.source_name ?? citation.source_name,
    };
  });
}

function buildContextFromHits(hits: DocumentHit[], limit = 8) {
  const selected = hits.slice(0, limit);
  const contextParts = selected
    .map((hit, index) => {
      const snippet = snippetToText(hit.snippet_html);
      if (!snippet) {
        return "";
      }
      return [
        `[${index + 1}] Documento: ${hit.title}`,
        `Fuente: ${hit.source_name ?? hit.title}`,
        `Pagina: ${hit.page_start}-${hit.page_end}`,
        `Score: ${hit.score.toFixed(3)}`,
        `Contenido: ${snippet}`,
      ].join("\n");
    })
    .filter(Boolean);

  return contextParts.join("\n\n---\n\n").slice(0, 9000);
}

async function generateWithOllama(prompt: string): Promise<AskModelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_ASK_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_URL.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 320,
          num_ctx: 4096,
        },
        keep_alive: "30m",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        answer: null,
        error: `Ollama failed: ${detail.slice(0, 220)}`,
      };
    }

    const payload = (await response.json()) as { response?: string };
    const answer = payload.response?.replace(/\s+/g, " ").trim() ?? "";
    if (!answer) {
      return {
        answer: null,
        error: "Ollama returned empty response.",
      };
    }

    return { answer, error: null };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `Ollama timeout (${OLLAMA_ASK_TIMEOUT_MS / 1000}s)`
        : error instanceof Error
        ? error.message
        : "Unknown Ollama error";
    return { answer: null, error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function askWithRetrievedContext(
  question: string,
  hits: DocumentHit[]
): Promise<AskModelResult> {
  const context = buildContextFromHits(hits, 8).trim();
  if (!context) {
    return {
      answer: null,
      error: "No searchable context snippets found.",
    };
  }

  const prompt = [
    "Eres GandalFS, asistente de busqueda documental.",
    "Responde SOLO con informacion del CONTEXTO.",
    "Si no hay evidencia suficiente, responde exactamente:",
    '"No se encontró contexto suficiente en los documentos para responder con certeza."',
    "No inventes nombres ni datos.",
    "Responde breve y claro en el idioma de la pregunta.",
    "",
    `PREGUNTA: ${question}`,
    "",
    "CONTEXTO:",
    context,
    "",
    "RESPUESTA:",
  ].join("\n");

  return generateWithOllama(prompt);
}

async function askGeneralWithOllama(question: string): Promise<AskModelResult> {
  const prompt = [
    "You are GandalFS, a helpful enterprise assistant.",
    "Answer the user's question directly and concisely.",
    "Use the same language as the user.",
    "Do not mention document retrieval or citations unless explicitly asked.",
    "",
    `Question: ${question}`,
    "Answer:",
  ].join("\n");

  return generateWithOllama(prompt);
}

async function tryBackendAsk(baseUrl: string, question: string): Promise<AskProbeResult> {
  const askEndpoints = ["/ask"];
  const errors: string[] = [];
  let foundEndpoint = false;

  for (const endpoint of askEndpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_ASK_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
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
        const fallbackCitations =
          Array.isArray(data.sources) && data.sources.length > 0
            ? data.sources.map((source) => ({
                doc_id: "unknown",
                title: source.file ?? "Document",
                page: Number(source.chunk ?? 0) + 1,
                snippet_html: "",
                doc_type: detectDocType(source.file ?? ""),
                source_name: source.file ?? "Document",
              }))
            : [];
        const mappedCitations = (data.citations ?? []).map((citation) => ({
          doc_id: citation.doc_id ?? "unknown",
          title: citation.title ?? "Document",
          page: Number(citation.page ?? 1),
          snippet_html: citation.snippet_html ?? "",
          doc_type: citation.doc_type,
          source_name: citation.source_name,
        }));
        return {
          response: {
            answer: data.answer,
            citations: mappedCitations.length > 0 ? mappedCitations : fallbackCitations,
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

async function loadSearchContext(baseUrl: string, question: string): Promise<SearchContextResult> {
  try {
    let rawSearch;
    try {
      rawSearch = await searchBackendRaw(baseUrl, question);
    } catch (error) {
      const details = getBackendErrorDetails(error);
      if (!requiresIndexReinit(details)) {
        throw error;
      }
      await initBackendIndex(baseUrl);
      rawSearch = await searchBackendRaw(baseUrl, question);
    }

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

  const [backendAsk, searchContext] = await Promise.all([
    tryBackendAsk(baseUrl, question),
    loadSearchContext(baseUrl, question),
  ]);

  const thresholdHits = searchContext.hits.filter(
    (hit) => Number.isFinite(hit.score) && hit.score >= ASK_MIN_SCORE
  );
  const rankedHits = thresholdHits.length > 0 ? thresholdHits : searchContext.hits;

  const backendAnswer = backendAsk.response?.answer?.trim() ?? "";
  const backendNoContext = looksLikeNoContextAnswer(backendAnswer);

  if (backendAsk.response && !backendNoContext) {
    const normalizedCitations = uniqueCitations(
      mapCitationsToKnownDocs(backendAsk.response.citations ?? [], searchContext.hits)
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

  const contextual =
    rankedHits.length > 0
      ? await askWithRetrievedContext(question, rankedHits)
      : ({ answer: null, error: "No ranked hits for contextual ask." } as AskModelResult);

  if (contextual.answer && !looksLikeNoContextAnswer(contextual.answer)) {
    return NextResponse.json({
      answer: contextual.answer,
      citations: pickDiverseCitationsFromHits(rankedHits, 6),
    } satisfies AskResponse);
  }

  const general = await askGeneralWithOllama(question);
  if (general.answer) {
    return NextResponse.json({
      answer: general.answer,
      citations: [],
    } satisfies AskResponse);
  }

  if (contextual.answer) {
    return NextResponse.json({
      answer: contextual.answer,
      citations: [],
    } satisfies AskResponse);
  }

  if (backendAnswer && backendNoContext) {
    return NextResponse.json({
      answer: backendAnswer,
      citations: [],
    } satisfies AskResponse);
  }

  return NextResponse.json(
    {
      error: "Ask failed: no se pudo responder con contexto ni en modo general.",
      details: [
        ...backendAsk.errors,
        ...searchContext.errors,
        ...(contextual.error ? [contextual.error] : []),
        ...(general.error ? [general.error] : []),
      ],
    },
    { status: 502 }
  );
}
