import { NextResponse } from "next/server";

import { getUploadRegistryEntryByDocId } from "@/server/upload-registry";
import { getCachedDocumentById } from "@/store/search-cache";

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
  const enriched = entry
    ? {
        ...document,
        open_url: `/api/files/${params.docId}?disposition=inline`,
        download_url: `/api/files/${params.docId}?disposition=attachment`,
      }
    : document;

  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(enriched);
}
