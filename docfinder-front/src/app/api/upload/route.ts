import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 650));

  const docId = `DOC-${Math.floor(Math.random() * 900 + 100)}`;
  return NextResponse.json({
    ok: true,
    doc_id: docId,
    name: file.name,
    received: {
      doc_type: String(formData.get("doc_type") ?? "unknown"),
      category: String(formData.get("category") ?? "unknown"),
      tags: String(formData.get("tags") ?? ""),
      lang: String(formData.get("lang") ?? "en"),
    },
  });
}
