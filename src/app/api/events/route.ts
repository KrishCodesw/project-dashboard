import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, metadata, timestamp } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    // Log to stdout in production (captured by logging infrastructure)
    console.log(
      JSON.stringify({
        type: "workspace_event",
        event,
        metadata: metadata ?? {},
        timestamp: timestamp ?? new Date().toISOString(),
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
