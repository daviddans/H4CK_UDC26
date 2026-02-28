import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { question?: string };
  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured in frontend." },
      { status: 500 }
    );
  }

  // The current backend does not expose /ask. We return a clear contract error.
  return NextResponse.json(
    {
      error: "Backend endpoint /ask is not available.",
      details: [`Question received: ${question}`],
    },
    { status: 501 }
  );
}
