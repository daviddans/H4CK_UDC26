import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function saveFile(file: File) {
  const uploadDir =
    process.env.BACKEND_UPLOAD_DIR ??
    path.join(process.cwd(), ".tmp-backend-uploads");
  await mkdir(uploadDir, { recursive: true });

  const docId = `UPL-${randomUUID().slice(0, 8).toUpperCase()}`;
  const filename = `${docId}-${sanitizeName(file.name || "document")}`;
  const fullPath = path.join(uploadDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, bytes);

  return { docId, fullPath };
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured in frontend." },
      { status: 500 }
    );
  }

  const metadata = {
    doc_type: String(formData.get("doc_type") ?? "unknown"),
    category: String(formData.get("category") ?? "unknown"),
    tags: String(formData.get("tags") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  };

  const { docId, fullPath } = await saveFile(file);
  const attempts: Array<{ url: string; init: RequestInit; label: string }> = [
    {
      url: `${baseUrl.replace(/\/$/, "")}/add-index?path=${encodeURIComponent(fullPath)}`,
      init: { method: "GET" },
      label: "GET /add-index?path=...",
    },
    {
      url: `${baseUrl.replace(/\/$/, "")}/add-index`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath }),
      },
      label: "POST /add-index {path}",
    },
    {
      url: `${baseUrl.replace(/\/$/, "")}/add-index`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: { path: fullPath } }),
      },
      label: "POST /add-index {file:{path}}",
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.init);
      const text = await response.text();
      if (response.ok) {
        return NextResponse.json({
          ok: true,
          mode: "backend",
          doc_id: docId,
          name: file.name,
          saved_path: fullPath,
          received: metadata,
          backend: {
            attempt: attempt.label,
            response: text,
          },
        });
      }
      errors.push(`${attempt.label} -> ${response.status}: ${text.slice(0, 200)}`);
    } catch (error) {
      errors.push(
        `${attempt.label} -> ${error instanceof Error ? error.message : "Network error"}`
      );
    }
  }

  return NextResponse.json(
    {
      error: "Upload saved locally but backend indexing failed.",
      doc_id: docId,
      saved_path: fullPath,
      details: errors,
    },
    { status: 502 }
  );
}
