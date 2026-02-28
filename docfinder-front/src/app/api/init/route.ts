import { NextResponse } from "next/server";

export async function POST() {
  const baseUrl = process.env.BACKEND_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "BACKEND_URL is not configured in frontend." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/init`, {
      method: "GET",
    });
    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Backend init failed.",
          details: [text.slice(0, 240)],
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      response: text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Backend init request failed.",
        details: [error instanceof Error ? error.message : "Network error"],
      },
      { status: 502 }
    );
  }
}
