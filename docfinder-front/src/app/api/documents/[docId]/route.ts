import { NextResponse } from "next/server";

import { getDocumentById } from "@/lib/mock-data";

export async function GET(
  _req: Request,
  context: { params: Promise<{ docId: string }> }
) {
  const params = await context.params;
  const document = getDocumentById(params.docId);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(document);
}
