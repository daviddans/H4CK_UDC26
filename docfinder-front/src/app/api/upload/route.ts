import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { upsertUploadRegistryEntry } from "@/server/upload-registry";
import { countDocumentPagesFromBuffer } from "@/server/page-counter";
import { getBackendUploadDir } from "@/server/storage-paths";

export const runtime = "nodejs";

const TEXT_EXTENSIONS = new Set([".txt", ".csv", ".md", ".log"]);
const BACKEND_TEXT_SAFE_REGEX = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ@%/+\-=#_.,:;?!\s]/g;

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function buildDeterministicDocId(filename: string) {
  const normalized = sanitizeName(filename || "document").toLowerCase();
  const digest = createHash("sha1").update(normalized).digest("hex");
  return `UPL-${digest.slice(0, 8).toUpperCase()}`;
}

function toBackendSafeText(raw: string) {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const backendLike = normalized.replace(BACKEND_TEXT_SAFE_REGEX, "").replace(/\s+/g, " ").trim();

  if (backendLike.length >= 8) {
    return normalized;
  }

  const escapedTokens = Array.from(normalized)
    .slice(0, 2000)
    .map((char) => {
      const code = char.codePointAt(0);
      return code ? `u${code.toString(16)}` : "";
    })
    .filter(Boolean)
    .join(" ");

  if (!escapedTokens) {
    return `${normalized}\n\nfallback_tokens empty_content`;
  }

  return `${normalized}\n\nfallback_tokens ${escapedTokens}`;
}

async function saveFile(file: File) {
  const uploadDir = getBackendUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const safeOriginalName = sanitizeName(file.name || "document");
  const docId = buildDeterministicDocId(safeOriginalName);
  const filename = safeOriginalName;
  const fullPath = path.join(uploadDir, filename);
  const ext = path.extname(file.name || "").toLowerCase();
  let bytes = Buffer.from(await file.arrayBuffer());

  // Some backends fail extracting text for non-latin/short text files.
  // We keep original content and append ascii-safe tokens only when needed.
  if (TEXT_EXTENSIONS.has(ext)) {
    try {
      const rawText = await file.text();
      const safeText = toBackendSafeText(rawText);
      bytes = Buffer.from(safeText, "utf-8");
    } catch {
      // Keep original bytes if browser text decoding fails.
    }
  }

  await writeFile(fullPath, bytes);

  return { docId, fullPath, bytes };
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
    tags: String(formData.get("tags") ?? ""),
  };

  const { docId, fullPath, bytes } = await saveFile(file);
  const sourceName = path.basename(fullPath);
  const pageCount = countDocumentPagesFromBuffer(file.name || sourceName, bytes);
  upsertUploadRegistryEntry({
    doc_id: docId,
    source_name: sourceName,
    original_name: file.name || sourceName,
    saved_path: fullPath,
    page_count: pageCount,
    tags: metadata.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    uploaded_at: new Date().toISOString(),
  });

  const attempts: Array<{ url: string; init: RequestInit; label: string }> = [
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
    {
      url: `${baseUrl.replace(/\/$/, "")}/add-index?path=${encodeURIComponent(fullPath)}`,
      init: { method: "GET" },
      label: "GET /add-index?path=...",
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
