import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getBackendUploadDir } from "@/server/storage-paths";

import type { DocumentDetail, DocumentHit } from "@/types/docfinder";

const documentCache = new Map<string, Map<string, DocumentHit>>();
let loadedFromDisk = false;

type DiskCache = {
  byDocId: Record<string, DocumentHit[]>;
};

function sanitizeTags(tags: string[] | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag) => tag.toLowerCase() !== "indexed")
    )
  );
}

function getCacheFilePath() {
  const uploadDir = getBackendUploadDir();
  return path.join(uploadDir, ".docfinder-search-cache.json");
}

function ensureLoaded() {
  if (loadedFromDisk) {
    return;
  }
  loadedFromDisk = true;
  const cacheFile = getCacheFilePath();
  if (!existsSync(cacheFile)) {
    return;
  }

  try {
    const raw = readFileSync(cacheFile, "utf-8");
    const parsed = JSON.parse(raw) as DiskCache;
    for (const [docId, hits] of Object.entries(parsed.byDocId ?? {})) {
      const byChunk = new Map<string, DocumentHit>();
      for (const hit of Array.isArray(hits) ? hits : []) {
        byChunk.set(hit.chunk_id, {
          ...hit,
          tags: sanitizeTags(hit.tags),
        });
      }
      if (byChunk.size > 0) {
        documentCache.set(docId, byChunk);
      }
    }
  } catch {
    // Ignore corrupted cache and continue with in-memory cache.
  }
}

function persistToDisk() {
  const cacheFile = getCacheFilePath();
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  const byDocId: Record<string, DocumentHit[]> = {};
  for (const [docId, chunks] of documentCache.entries()) {
    byDocId[docId] = Array.from(chunks.values());
  }
  writeFileSync(cacheFile, JSON.stringify({ byDocId }, null, 2), "utf-8");
}

export function cacheHits(hits: DocumentHit[]) {
  ensureLoaded();
  for (const hit of hits) {
    const byChunk = documentCache.get(hit.doc_id) ?? new Map<string, DocumentHit>();
    byChunk.set(hit.chunk_id, {
      ...hit,
      tags: sanitizeTags(hit.tags),
    });
    documentCache.set(hit.doc_id, byChunk);
  }
  persistToDisk();
}

export function getCachedDocumentById(docId: string): DocumentDetail | null {
  ensureLoaded();
  const chunksById = documentCache.get(docId);
  if (!chunksById || chunksById.size === 0) {
    return null;
  }

  const chunks = Array.from(chunksById.values()).sort(
    (a, b) => a.page_start - b.page_start || b.score - a.score
  );
  const first = chunks[0];

  return {
    doc_id: docId,
    title: first.title,
    doc_type: first.doc_type,
    category: first.category,
    tags: first.tags,
    lang: first.lang,
    date: first.date,
    score: first.score,
    source_name: first.source_name,
    source_path: first.source_path,
    chunks,
  };
}

export function removeCachedDocumentById(docId: string) {
  ensureLoaded();
  documentCache.delete(docId);
  persistToDisk();
}

export function updateCachedDocumentTagsById(docId: string, tags: string[]) {
  ensureLoaded();
  const byChunk = documentCache.get(docId);
  if (!byChunk || byChunk.size === 0) {
    return false;
  }

  const cleanTags = sanitizeTags(tags);
  for (const [chunkId, hit] of byChunk.entries()) {
    byChunk.set(chunkId, { ...hit, tags: cleanTags });
  }
  documentCache.set(docId, byChunk);
  persistToDisk();
  return true;
}

export function listCachedDocuments(): DocumentDetail[] {
  ensureLoaded();
  return Array.from(documentCache.keys())
    .map((docId) => getCachedDocumentById(docId))
    .filter((item): item is DocumentDetail => Boolean(item));
}
