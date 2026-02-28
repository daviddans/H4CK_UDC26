import { NextResponse } from "next/server";
import path from "node:path";

import { getUploadRegistryEntryByDocId } from "@/server/upload-registry";
import { getCachedDocumentById } from "@/store/search-cache";

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

export async function GET(
  _req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const document = getCachedDocumentById(params.docId);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const entry = getUploadRegistryEntryByDocId(params.docId);
  const sourcePath = entry?.saved_path ?? document.source_path ?? document.chunks.find((chunk) => chunk.source_path)?.source_path;
  const sourceName = entry?.original_name ?? document.source_name ?? document.chunks.find((chunk) => chunk.source_name)?.source_name;
  const enriched = sourcePath
    ? {
        ...document,
        source_name: sourceName,
        source_path: sourcePath,
        viewer_type: inferViewerType(sourcePath),
        open_url: `/api/files/${params.docId}?disposition=inline`,
        download_url: `/api/files/${params.docId}?disposition=attachment`,
      }
    : document;

  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(enriched);
}
