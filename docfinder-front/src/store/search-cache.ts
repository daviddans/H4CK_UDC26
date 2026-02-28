import type { DocumentDetail, DocumentHit } from "@/types/docfinder";

const documentCache = new Map<string, Map<string, DocumentHit>>();

export function cacheHits(hits: DocumentHit[]) {
  for (const hit of hits) {
    const byChunk = documentCache.get(hit.doc_id) ?? new Map<string, DocumentHit>();
    byChunk.set(hit.chunk_id, hit);
    documentCache.set(hit.doc_id, byChunk);
  }
}

export function getCachedDocumentById(docId: string): DocumentDetail | null {
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
