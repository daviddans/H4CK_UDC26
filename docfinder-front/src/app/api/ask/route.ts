import { NextResponse } from "next/server";

import { askMock } from "@/lib/mock-data";
import { AskResponse, Citation } from "@/lib/types";

const getBackendBaseUrl = () => process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

const toCitations = (value: unknown): Citation[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      return {
        doc_id: String(record.doc_id ?? record.id ?? `BACK-${index + 1}`),
        title: String(record.title ?? record.document ?? `Backend source ${index + 1}`),
        page: Number(record.page ?? record.page_start ?? 1),
        snippet_html: String(record.snippet_html ?? record.snippet ?? "No snippet"),
      };
    })
    .filter((item): item is Citation => Boolean(item));
};

const normalizeAsk = (payload: unknown): AskResponse | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.answer !== "string") {
    return null;
  }

  return {
    answer: record.answer,
    citations: toCitations(record.citations),
  };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: string };
  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const baseUrl = getBackendBaseUrl();
  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        cache: "no-store",
      });

      if (response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        const normalized = normalizeAsk(payload);
        if (normalized) {
          return NextResponse.json(normalized);
        }
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json(askMock(question));
}
