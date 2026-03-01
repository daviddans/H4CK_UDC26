import type { DocumentHit } from "@/types/docfinder";
import { getUploadRegistryEntryBySource } from "@/server/upload-registry";
import path from "node:path";

type BackendSourceMetadata = {
  source?: string;
  source_name?: string;
  chunk_id?: number | string;
  doc_id?: string;
  title?: string;
  doc_type?: string;
  category?: string;
  tags?: string[] | string;
  lang?: string;
  type?: string;
  date?: string;
  creation_date?: string;
  page_start?: number | string;
  page_end?: number | string;
  page?: number | string;
  page_number?: number | string;
  pages?: number | string;
  path?: string;
  file_path?: string;
  source_path?: string;
  full_path?: string;
  file?: string;
  dir?: string;
  source_dir?: string;
  directory?: string;
};

type BackendRawHit = {
  _score?: number;
  _source?: {
    content?: string;
    chunk_data?: {
      source?: string;
      chunk_id?: number | string;
    };
    metadata?: BackendSourceMetadata;
  };
};

export type BackendSearchResponse = {
  hits?: {
    hits?: BackendRawHit[];
  };
};

type SearchPayloadVariants = {
  querry?: string;
  query?: string;
  q?: string;
};

function asStringList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag) => tag.toLowerCase() !== "indexed")
    )
  );
}

function toNumber(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function hasValue(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return false;
}

function escapeCharClass(value: string) {
  return value.replace(/[-\\\]^]/g, "\\$&");
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

function stripUploadPrefix(filename: string) {
  return filename.replace(/^UPL-[A-Z0-9]{8,}-/i, "");
}

function normalizeSourceName(value: string) {
  const normalized = path.basename(value.trim().replaceAll("\\", "/"));
  return normalized || value.trim();
}

function normalizeLang(value: string | undefined) {
  if (!value) {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["unknown", "unk", "n/a", "na", "none", "null"].includes(normalized)) {
    return "";
  }
  return normalized;
}

function inferLanguageFromText(text: string) {
  if (!text) {
    return "";
  }

  // Unified Han characters: Chinese (fallback generic zh for CJK Han script).
  if (/[\u3400-\u4DBF\u4E00-\u9FFF]/u.test(text)) {
    return "zh";
  }
  // Japanese kana.
  if (/[\u3040-\u30FF]/u.test(text)) {
    return "ja";
  }
  // Korean Hangul.
  if (/[\uAC00-\uD7AF]/u.test(text)) {
    return "ko";
  }
  // Cyrillic.
  if (/[\u0400-\u04FF]/u.test(text)) {
    return "ru";
  }
  // Arabic.
  if (/[\u0600-\u06FF]/u.test(text)) {
    return "ar";
  }

  return "";
}

function resolveLanguage(
  metadataLang: string | undefined,
  metadataType: string | undefined,
  uploadLang: string | undefined,
  content: string,
  title: string,
  sourceName: string
) {
  const explicit = normalizeLang(metadataLang) || normalizeLang(metadataType) || normalizeLang(uploadLang);
  if (explicit) {
    return explicit;
  }

  const inferred = inferLanguageFromText(`${content} ${title} ${sourceName}`);
  return inferred || "unknown";
}

function makeDocId(source: string) {
  const slug = source
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `BACK-${slug || "document"}`;
}

const DIACRITIC_EQUIVALENTS: Record<string, string> = {
  a: "aàáâãäåāăą",
  c: "cçćč",
  d: "dďđ",
  e: "eèéêëēĕėęě",
  i: "iìíîïīĭįı",
  l: "lł",
  n: "nñńň",
  o: "oòóôõöōŏőø",
  r: "rŕř",
  s: "sśŝşš",
  t: "tţť",
  u: "uùúûüūŭůűų",
  y: "yýÿ",
  z: "zźżž",
};

type TextRange = { start: number; end: number };

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function buildLooseTokenRegex(token: string) {
  const chars = [...token];
  if (!chars.length) {
    return null;
  }

  const separatorPattern = "[\\s\\p{P}\\p{S}_-]*";
  const flexibleGap = token.length >= 5 ? "(?:[\\p{L}\\p{N}])?" : "";
  const pattern = chars
    .map((char) => {
      const mapped = DIACRITIC_EQUIVALENTS[char] ?? char;
      return `[${escapeCharClass(mapped)}]`;
    })
    .join(`${separatorPattern}${flexibleGap}`);

  try {
    return new RegExp(pattern, "giu");
  } catch {
    return null;
  }
}

function mergeRanges(ranges: TextRange[]) {
  if (!ranges.length) {
    return [];
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push(current);
  }

  return merged;
}

function collectMatchRanges(text: string, regexes: RegExp[]) {
  const ranges: TextRange[] = [];
  const MAX_RANGES = 80;

  for (const regex of regexes) {
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      const value = match[0];
      if (value) {
        ranges.push({ start: match.index, end: match.index + value.length });
        if (ranges.length >= MAX_RANGES) {
          return mergeRanges(ranges);
        }
      }
      if (regex.lastIndex === match.index) {
        regex.lastIndex += 1;
      }
      match = regex.exec(text);
    }
  }

  return mergeRanges(ranges);
}

function buildMarkedSnippet(text: string, ranges: TextRange[], from: number, to: number) {
  const clippedRanges = ranges
    .filter((range) => range.end > from && range.start < to)
    .map((range) => ({
      start: Math.max(range.start, from),
      end: Math.min(range.end, to),
    }));

  let html = from > 0 ? "..." : "";
  let cursor = from;

  for (const range of clippedRanges) {
    if (range.start > cursor) {
      html += escapeHtml(text.slice(cursor, range.start));
    }
    html += `<mark>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  if (cursor < to) {
    html += escapeHtml(text.slice(cursor, to));
  }
  if (to < text.length) {
    html += "...";
  }

  return html;
}

function makeSnippet(content: string, queryText: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "<span>No snippet available</span>";
  }

  const tokens = Array.from(
    new Set(
      queryText
        .split(/\s+/)
        .map((token) => normalizeToken(token.trim()))
        .filter((token) => token.length > 1)
    )
  ).slice(0, 8);

  const tokenRegexes = tokens
    .map((token) => buildLooseTokenRegex(token))
    .filter((regex): regex is RegExp => Boolean(regex));

  const ranges = collectMatchRanges(clean, tokenRegexes);

  let from = 0;
  if (ranges.length) {
    from = Math.max(0, ranges[0].start - 80);
  }

  const to = Math.min(clean.length, from + 260);
  if (!ranges.length) {
    const prefix = from > 0 ? "..." : "";
    const suffix = to < clean.length ? "..." : "";
    return `${prefix}${escapeHtml(clean.slice(from, to))}${suffix}`;
  }

  return buildMarkedSnippet(clean, ranges, from, to);
}

export async function searchBackendRaw(baseUrl: string, queryText: string): Promise<BackendSearchResponse> {
  const backendAttempts: SearchPayloadVariants[] = [
    { query: queryText },
    { q: queryText },
    { querry: queryText },
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
          errors.push(`${path} payload=${JSON.stringify(payload)} -> ${response.status}: ${text.slice(0, 240)}`);
          continue;
        }

        return (await response.json()) as BackendSearchResponse;
      } catch (error) {
        errors.push(
          `${path} payload=${JSON.stringify(payload)} -> ${error instanceof Error ? error.message : "Network error"}`
        );
      }
    }
  }

  const err = new Error("Backend search failed.");
  (err as Error & { details?: string[] }).details = errors;
  throw err;
}

export async function initBackendIndex(baseUrl: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/init`, {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error("Backend init failed.");
    (err as Error & { details?: string[] }).details = [text.slice(0, 240)];
    throw err;
  }
}

export function getBackendErrorDetails(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return [];
  }
  if (!("details" in error)) {
    return [];
  }
  const details = (error as { details?: unknown }).details;
  return Array.isArray(details) ? details.map((value) => String(value)) : [];
}

export function mapBackendHits(payload: BackendSearchResponse, queryText: string): DocumentHit[] {
  const rawHits = payload.hits?.hits ?? [];

  return rawHits.map((hit, index) => {
    const metadata = hit._source?.metadata ?? {};
    const chunkData = hit._source?.chunk_data ?? {};
    const rawSourceNameValue =
      metadata.source_name ?? metadata.source ?? chunkData.source ?? `document-${index + 1}.txt`;
    const rawSourceName = String(rawSourceNameValue);
    const normalizedSourceName = normalizeSourceName(rawSourceName);
    const uploadMeta =
      getUploadRegistryEntryBySource(rawSourceName) ??
      getUploadRegistryEntryBySource(normalizedSourceName) ??
      getUploadRegistryEntryBySource(stripUploadPrefix(normalizedSourceName));
    const sourceName = uploadMeta?.original_name ?? stripUploadPrefix(normalizedSourceName);
    const chunkRaw = metadata.chunk_id ?? chunkData.chunk_id ?? index;
    const chunkId = toNumber(chunkRaw, index);
    const content = hit._source?.content ?? "";
    const docId =
      metadata.doc_id ??
      uploadMeta?.doc_id ??
      makeDocId(normalizedSourceName || rawSourceName || sourceName);
    const titleSource =
      uploadMeta?.original_name ??
      (typeof metadata.title === "string" ? stripUploadPrefix(metadata.title) : undefined) ??
      sourceName;
    const title = formatTitle(titleSource);
    const tags = asStringList(metadata.tags);
    const mergedTags = normalizeTags([...(tags ?? []), ...(uploadMeta?.tags ?? [])]);
    const pageStartRaw = metadata.page_start ?? metadata.page_number ?? metadata.page;
    const pageStart = hasValue(pageStartRaw) ? Math.max(1, toNumber(pageStartRaw, 1)) : 1;
    const pageEnd = hasValue(metadata.page_end)
      ? Math.max(pageStart, toNumber(metadata.page_end, pageStart))
      : pageStart;
    const totalPages = toNumber(metadata.pages, uploadMeta?.page_count ?? 0);
    const resolvedLanguage = resolveLanguage(
      typeof metadata.lang === "string" ? metadata.lang : undefined,
      typeof metadata.type === "string" ? metadata.type : undefined,
      uploadMeta?.lang,
      content,
      title,
      sourceName
    );
    const detectedType = sourceName.split(".").pop()?.toLowerCase() || "document";
    const directPathCandidates = [
      metadata.file_path,
      metadata.source_path,
      metadata.full_path,
      metadata.path,
      metadata.file,
      rawSourceName.includes("/") || rawSourceName.includes("\\") ? rawSourceName : "",
      uploadMeta?.saved_path,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);

    const dirCandidate =
      (typeof metadata.dir === "string" && metadata.dir.trim()) ||
      (typeof metadata.source_dir === "string" && metadata.source_dir.trim()) ||
      (typeof metadata.directory === "string" && metadata.directory.trim()) ||
      "";

    const sourcePath =
      directPathCandidates[0] ||
      (dirCandidate ? path.join(dirCandidate, normalizedSourceName) : undefined);

    return {
      doc_id: docId,
      chunk_id: `${docId}-${chunkId}`,
      title,
      doc_type: metadata.doc_type ?? uploadMeta?.doc_type ?? detectedType,
      category: metadata.category ?? uploadMeta?.category ?? "backend",
      tags: mergedTags,
      page_start: pageStart,
      page_end: pageEnd,
      total_pages: totalPages > 0 ? totalPages : undefined,
      lang: resolvedLanguage,
      date: metadata.date ?? metadata.creation_date ?? "",
      score: Number(hit._score ?? 0),
      snippet_html: makeSnippet(content, queryText),
      source_name: sourceName,
      source_path: sourcePath,
    };
  });
}

export function snippetToText(snippetHtml: string): string {
  return snippetHtml
    .replace(/<mark>/g, "")
    .replace(/<\/mark>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
