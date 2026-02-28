import { NextResponse } from "next/server";

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

  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(document);
}
