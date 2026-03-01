import { NextResponse } from "next/server";

import {
  listUploadRegistryTags,
  removeTagFromUploadRegistry,
} from "@/server/upload-registry";
import { addManualTag, listManualTags, removeManualTag } from "@/server/tag-catalog";

export const runtime = "nodejs";

function mergeTags(...lists: string[][]) {
  return Array.from(new Set(lists.flatMap((list) => list.map((tag) => tag.trim().toLowerCase()).filter(Boolean))))
    .sort((a, b) => a.localeCompare(b));
}

export async function GET() {
  return NextResponse.json({
    tags: mergeTags(listUploadRegistryTags(), listManualTags()),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tag?: string };
  const tag = body.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "Tag is required" }, { status: 400 });
  }

  const manual = addManualTag(tag);
  return NextResponse.json({
    ok: true,
    tags: mergeTags(listUploadRegistryTags(), manual),
  });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tag?: string };
  const tag = body.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "Tag is required" }, { status: 400 });
  }

  const manual = removeManualTag(tag);
  const removal = removeTagFromUploadRegistry(tag);
  return NextResponse.json({
    ok: true,
    updated_documents: removal.updated,
    tags: mergeTags(listUploadRegistryTags(), manual),
  });
}
