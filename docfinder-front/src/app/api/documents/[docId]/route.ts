import { NextResponse } from "next/server";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";

import {
  getUploadRegistryEntryByDocId,
  removeUploadRegistryEntryByDocId,
  updateUploadRegistryTagsByDocId,
} from "@/server/upload-registry";
import {
  getCachedDocumentById,
  removeCachedDocumentById,
  cacheHits,
  updateCachedDocumentTagsById,
} from "@/store/search-cache";
import type { DocumentDetail } from "@/types/docfinder";
import { mapBackendHits, searchBackendRaw } from "@/server/backend-contract";
import { countDocumentPages } from "@/server/page-counter";

export const runtime = "nodejs";

function inferViewerType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    return "pdf" as const;
  }
  if (ext === ".txt" || ext === ".md" || ext === ".log") {
    return "text" as const;
  }
  if (ext === ".csv") {
    return "csv" as const;
  }
  if (ext === ".xlsx" || ext === ".xls") {
    return "spreadsheet" as const;
  }
  return "binary" as const;
}

function makeTitle(sourceName: string, docId: string) {
  const base = sourceName.replace(/^UPL-[A-Z0-9]{8,}-/i, "") || docId;
  return base.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[_-]+/g, " ").trim();
}

function normalizeQueryFromFilename(filename: string) {
  return filename.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[_-]+/g, " ").trim();
}

function normalizeName(value: string) {
  return value
    .replace(/^UPL-[A-Z0-9]{8,}-/i, "")
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replaceAll("\\", "/")
    .split("/")
    .pop()
    ?.trim()
    .toLowerCase() ?? "";
}

function isTempUploadPath(value?: string) {
  if (!value) {
    return false;
  }
  return value.includes("/.tmp-backend-uploads/") || value.includes("\\.tmp-backend-uploads\\");
}

async function buildTextProbe(savedPath: string) {
  const ext = path.extname(savedPath).toLowerCase();
  if (![".txt", ".md", ".log", ".csv"].includes(ext)) {
    return "";
  }

  try {
    const raw = await readFile(savedPath, "utf-8");
    return raw
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((token) => token.length > 3)
      .slice(0, 16)
      .join(" ");
  } catch {
    return "";
  }
}

async function hydrateChunksFromBackend(docId: string) {
  const entry = getUploadRegistryEntryByDocId(docId);
  const baseUrl = process.env.BACKEND_URL?.trim();
  if (!entry || !baseUrl) {
    return null;
  }

  const textProbe = await buildTextProbe(entry.saved_path);
  const queryCandidates = [
    textProbe,
    normalizeQueryFromFilename(entry.original_name),
    entry.original_name,
    entry.source_name,
    "de",
    "the",
  ].filter(Boolean);
  const uniqueQueries = Array.from(new Set(queryCandidates));
  const targetSource = normalizeName(entry.source_name);
  const targetOriginal = normalizeName(entry.original_name);

  for (const query of uniqueQueries) {
    try {
      const payload = await searchBackendRaw(baseUrl, query);
      const mapped = mapBackendHits(payload, query);
      const related = mapped.filter(
        (hit) =>
          hit.doc_id === docId ||
          normalizeName(hit.source_name ?? "") === targetOriginal ||
          normalizeName(hit.source_name ?? "") === targetSource
      );
      if (related.length > 0) {
        cacheHits(related);
        return getCachedDocumentById(docId);
      }
    } catch {
      // Keep trying with next candidate.
    }
  }

  return null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const includeEvidence = new URL(req.url).searchParams.get("includeEvidence") === "1";
  let cachedDocument = getCachedDocumentById(params.docId);
  const cachedSourcePath =
    cachedDocument?.source_path ??
    cachedDocument?.chunks.find((chunk) => chunk.source_path)?.source_path;
  if (!cachedDocument || isTempUploadPath(cachedSourcePath)) {
    const hydrated = await hydrateChunksFromBackend(params.docId);
    if (hydrated) {
      cachedDocument = hydrated;
    }
  }
  const entry = getUploadRegistryEntryByDocId(params.docId);
  if (!cachedDocument && !entry) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const fallbackDocument: DocumentDetail | null = entry
    ? {
        doc_id: entry.doc_id,
        title: makeTitle(entry.original_name, entry.doc_id),
        doc_type: "document",
        category: "indexed",
        tags: entry.tags ?? [],
        lang: "unknown",
        date: "",
        score: 0,
        source_name: entry.original_name,
        source_path: entry.saved_path,
        chunks: [],
      }
    : null;

  const withEvidence = cachedDocument ?? fallbackDocument;
  const document = withEvidence
    ? includeEvidence
      ? withEvidence
      : {
          ...withEvidence,
          score: 0,
          chunks: [],
        }
    : null;
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const indexedSourcePath =
    document.source_path ?? document.chunks.find((chunk) => chunk.source_path)?.source_path;
  const entrySourcePath = entry?.saved_path;
  const sourcePath =
    !isTempUploadPath(entrySourcePath)
      ? entrySourcePath
      : !isTempUploadPath(indexedSourcePath)
      ? indexedSourcePath
      : entrySourcePath ?? indexedSourcePath;
  const sourceName =
    document.source_name ??
    document.chunks.find((chunk) => chunk.source_name)?.source_name ??
    entry?.original_name;
  const chunksMaxPage = document.chunks.reduce(
    (max, chunk) => Math.max(max, chunk.page_end),
    0
  );
  const filePageCount = sourcePath ? await countDocumentPages(sourcePath) : undefined;
  const totalPages = Math.max(entry?.page_count ?? 0, filePageCount ?? 0, chunksMaxPage, 1);
  const enriched = sourcePath
    ? {
        ...document,
        source_name: sourceName,
        source_path: sourcePath,
        total_pages: totalPages,
        viewer_type: inferViewerType(sourcePath),
        open_url: `/api/files/${params.docId}?disposition=inline`,
        download_url: `/api/files/${params.docId}?disposition=attachment`,
      }
    : { ...document, total_pages: totalPages };

  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(enriched);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const entry = getUploadRegistryEntryByDocId(params.docId);

  if (!entry) {
    removeCachedDocumentById(params.docId);
    return NextResponse.json(
      {
        error: "Document is not managed by upload registry.",
      },
      { status: 404 }
    );
  }

  let fileDeleted = false;
  let fileError: string | null = null;
  try {
    await unlink(entry.saved_path);
    fileDeleted = true;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ENOENT") {
      fileDeleted = true;
    } else {
      fileError = error instanceof Error ? error.message : "Unknown file delete error";
    }
  }

  removeUploadRegistryEntryByDocId(params.docId);
  removeCachedDocumentById(params.docId);

  if (fileError) {
    return NextResponse.json(
      {
        ok: false,
        doc_id: params.docId,
        file_deleted: fileDeleted,
        file_error: fileError,
        index_deleted: false,
        note: "File metadata was removed, but local file deletion failed.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    doc_id: params.docId,
    file_deleted: fileDeleted,
    index_deleted: false,
    note: "Local file removed. Backend index delete endpoint is not available.",
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const body = (await req.json().catch(() => ({}))) as { tags?: string[] };
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const updated = updateUploadRegistryTagsByDocId(params.docId, tags);

  if (!updated) {
    return NextResponse.json(
      { error: "Document is not managed by upload registry." },
      { status: 404 }
    );
  }

  updateCachedDocumentTagsById(params.docId, updated.tags);
  return NextResponse.json({
    ok: true,
    doc_id: params.docId,
    tags: updated.tags,
  });
}
