import path from "node:path";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getUploadRegistryEntryByDocId } from "@/server/upload-registry";
import { getCachedDocumentById } from "@/store/search-cache";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getMimeType(filePath: string) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const entry = getUploadRegistryEntryByDocId(params.docId);
  const cachedDoc = getCachedDocumentById(params.docId);
  const cachedPath = cachedDoc?.source_path ?? cachedDoc?.chunks.find((chunk) => chunk.source_path)?.source_path;
  const filePath = entry?.saved_path ?? cachedPath;

  if (!filePath) {
    return NextResponse.json({ error: "File not found for docId" }, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    const url = new URL(req.url);
    const disposition =
      url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const safeName = entry?.original_name || path.basename(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": getMimeType(filePath),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stored file is unavailable" }, { status: 404 });
  }
}
