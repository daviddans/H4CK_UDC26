import { NextResponse } from "next/server";

import { listUploadRegistryTags } from "@/server/upload-registry";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tags: listUploadRegistryTags() });
}
