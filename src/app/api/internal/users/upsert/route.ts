import { NextRequest, NextResponse } from "next/server";
import { upsertDashboardUser } from "@/lib/resolve-user";

/**
 * POST /api/internal/users/upsert
 *
 * Internal endpoint called by COE Main to synchronise user records.
 * Protected by SYNC_SECRET shared secret.
 *
 * This is NOT a public API. It is only reachable from COE Main's
 * internal network (or via the shared secret).
 *
 * Request body:
 * {
 *   email: string;        // required
 *   name?: string;
 *   role: string;         // STUDENT | FACULTY | ADMIN | INDUSTRY_PARTNER
 *   department?: string;
 *   uid?: string;
 *   status: string;       // ACTIVE | PENDING | REJECTED
 *   isActive?: boolean;
 * }
 *
 * Response:
 * { success: true, data: { id, name, email, role, created: boolean } }
 */
export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) {
    return NextResponse.json(
      { success: false, error: "SYNC_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("x-sync-secret");
  if (!authHeader || authHeader !== syncSecret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email as string | undefined;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { success: false, error: "Valid email is required" },
      { status: 400 }
    );
  }

  const role = body.role as string | undefined;
  if (!role) {
    return NextResponse.json(
      { success: false, error: "role is required" },
      { status: 400 }
    );
  }

  const status = body.status as string | undefined;
  if (!status) {
    return NextResponse.json(
      { success: false, error: "status is required" },
      { status: 400 }
    );
  }

  try {
    const result = await upsertDashboardUser({
      email,
      name: (body.name as string) || undefined,
      role,
      department: (body.department as string) || null,
      uid: (body.uid as string) || null,
      status,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
    });

    if (!result) {
      // Role not mappable — return success but indicate no action
      return NextResponse.json({
        success: true,
        data: null,
        note: `Unsupported role: ${role}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
    });
  } catch (err) {
    console.error("[INTERNAL SYNC] upsertDashboardUser error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
