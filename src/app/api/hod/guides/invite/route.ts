import { NextRequest } from "next/server";
import { inviteGuide } from "@/server/actions/hod-dashboard";
import { requireHOD } from "@/lib/coe-guard";

export async function POST(req: NextRequest) {
  try {
    await requireHOD();
    const body = await req.json();
    const result = await inviteGuide(body.email, body.name);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 400;
    return Response.json({ success: false, message }, { status });
  }
}