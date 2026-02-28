import { NextResponse } from "next/server";

import { runMockAsk } from "@/lib/mock-data";

export async function POST(req: Request) {
  const body = (await req.json()) as { question?: string };
  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 650));
  return NextResponse.json(runMockAsk(question));
}
