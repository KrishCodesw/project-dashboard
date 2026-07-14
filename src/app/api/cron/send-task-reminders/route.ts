import { NextRequest, NextResponse } from "next/server";
import { sendTaskReminders } from "@/lib/reminders/taskReminders";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.EMAIL_QUEUE_CRON_SECRET;
  if (!secret) return false;

  const bearer = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  const tokenHeader = req.headers.get("x-cron-token")?.trim();

  return bearer === secret || tokenHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!process.env.EMAIL_QUEUE_CRON_SECRET) {
    return NextResponse.json(
      { error: "EMAIL_QUEUE_CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendTaskReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task reminder job failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
