import { NextResponse } from "next/server";

import {
  getBackendErrorDetails,
  mapBackendHits,
  searchBackendRaw,
  snippetToText,
} from "@/server/backend-contract";
import type { AskResponse } from "@/types/docfinder";

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
        body: JSON.stringify({ question }),
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
  if (backendAsk.response) {
    return NextResponse.json(backendAsk.response);
  }
  if (!backendAsk.unavailable) {
    return NextResponse.json(
      {
        error: "Backend LLM ask failed.",
        details: backendAsk.errors,
      },
      { status: 502 }
    );
  }

  try {
    const rawSearch = await searchBackendRaw(baseUrl, question);
    const hits = mapBackendHits(rawSearch, question).sort((a, b) => b.score - a.score).slice(0, 6);

    const citations = hits.map((hit) => ({
      doc_id: hit.doc_id,
      title: hit.title,
      page: hit.page_start,
      snippet_html: hit.snippet_html,
    }));

    const answer = buildAnswerFromHits(
      question,
      hits.map((hit) => snippetToText(hit.snippet_html)).filter(Boolean)
    );

    return NextResponse.json({
      answer,
      citations,
    } satisfies AskResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Ask failed because backend search is unavailable.",
        details: getBackendErrorDetails(error),
      },
      { status: 502 }
    );
  }
}
