import { jwtVerify } from "jose";

type CoeRole = "ADMIN" | "FACULTY" | "STUDENT" | "INDUSTRY";
type CoeStatus = "ACTIVE" | "PENDING" | "REJECTED";

export interface CoeTokenPayload {
  email: string;
  name?: string;
  role: CoeRole;
  status: CoeStatus;
}

export function mapCoERoleToDashboard(role: string | null | undefined) {
  if (role === "ADMIN") return "ADMIN";
  if (role === "FACULTY") return "TEACHER";
  if (role === "STUDENT") return "STUDENT";
  return null;
}

export async function verifyCoEToken(
  token: string | null | undefined
): Promise<CoeTokenPayload | null> {
  if (!token) return null;

  const secret = process.env.COE_JWT_SECRET;
  if (!secret) return null;

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload || typeof payload !== "object") return null;

    const email = payload.email as string | undefined;
    const name = payload.name as string | undefined;
    const role = payload.role as CoeRole | undefined;
    const status = payload.status as CoeStatus | undefined;

    if (!email || !role || !status) return null;
    if (!mapCoERoleToDashboard(role)) return null;

    return { email, name, role, status };
  } catch {
    return null;
  }
}
