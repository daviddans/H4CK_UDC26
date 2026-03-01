import { NextResponse } from "next/server";

type SummarizeRequest = {
  title?: string;
  context?: string;
  lines?: number;
};

type OllamaGenerateResponse = {
  response?: string;
};

const OLLAMA_URL = process.env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b-instruct";
const OLLAMA_TIMEOUT_MS = 45_000;

function clampLines(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 2;
  }
  return Math.max(1, Math.min(3, Math.floor(value as number)));
}

function normalizeSummaryText(value: string, targetLines: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length >= targetLines) {
    return sentences.slice(0, targetLines).join(" ");
  }
  return compact;
}

function extractiveFallback(context: string, targetLines: number) {
  const compact = context.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return compact.slice(0, 420);
  }
  return sentences.slice(0, targetLines).join(" ");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SummarizeRequest;
  const title = (body.title ?? "documento").trim();
  const context = (body.context ?? "").replace(/\s+/g, " ").trim();
  const lines = clampLines(body.lines);

  if (!context) {
    return NextResponse.json(
      { error: "No hay contexto del documento para resumir." },
      { status: 400 }
    );
  }

  const prompt = [
    "Eres un asistente que SOLO resume el documento proporcionado.",
    "No respondas preguntas generales.",
    "No inventes datos ni añadas información externa.",
    `Devuelve un resumen de maximo ${lines} linea(s), en español claro y profesional.`,
    "",
    `DOCUMENTO: ${title}`,
    "CONTEXTO:",
    context.slice(0, 8000),
    "",
    "RESUMEN:",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
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
          num_predict: 160,
          num_ctx: 4096,
        },
        keep_alive: "30m",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const fallback = extractiveFallback(context, lines);
      if (fallback) {
        return NextResponse.json({ summary: normalizeSummaryText(fallback, lines), fallback: true });
      }
      const detail = await response.text();
      return NextResponse.json(
        { error: `Ollama summarize failed: ${detail.slice(0, 240)}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    const summary = normalizeSummaryText(payload.response ?? "", lines);
    if (!summary) {
      const fallback = extractiveFallback(context, lines);
      if (fallback) {
        return NextResponse.json({ summary: normalizeSummaryText(fallback, lines), fallback: true });
      }
      return NextResponse.json({ error: "No se pudo generar el resumen." }, { status: 502 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    const fallback = extractiveFallback(context, lines);
    if (fallback) {
      return NextResponse.json({ summary: normalizeSummaryText(fallback, lines), fallback: true });
    }
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? `Timeout (${OLLAMA_TIMEOUT_MS / 1000}s) generando resumen`
        : error instanceof Error
        ? error.message
        : "Unknown summarize error";
    return NextResponse.json({ error: reason }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
