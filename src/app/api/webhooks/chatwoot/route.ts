import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { SUPPORT_ENABLED } from "@/lib/support/feature-flag";
import { chatwootConfig } from "@/lib/chatwoot/config";
import { supportRepo } from "@/lib/support/SupportRepository";

const ACCOUNT_ID = String(chatwootConfig.accountId);

async function verifyHmac(payload: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(chatwootConfig.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(hexToBytes(signatureHeader));
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
}

export async function POST(req: NextRequest) {
  if (!SUPPORT_ENABLED) {
    return NextResponse.json({ ok: true });
  }

  // 1. Verify HMAC
  const body = await req.text();
  const signature = req.headers.get("x-chatwoot-signature");
  if (!(await verifyHmac(body, signature))) {
    console.warn("[Chatwoot Webhook] Invalid HMAC signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse event
  const payload = JSON.parse(body);

  // 3. Verify event comes from our account
  if (String(payload.account?.id) !== ACCOUNT_ID) {
    console.warn("[Chatwoot Webhook] Event from unknown account:", payload.account?.id);
    return NextResponse.json({ ok: true });
  }

  // 4. Only handle admin replies (message.created, outgoing)
  if (payload.event !== "message.created") return NextResponse.json({ ok: true });
  if (payload.message_type === "incoming") return NextResponse.json({ ok: true });
  if (!payload.conversation?.contact_id) return NextResponse.json({ ok: true });

  // 5. Lightweight dedup: skip if a TICKET_REPLIED notification for this conversation
  //    was created in the last 5 minutes. Chatwoot v4.14.0 has no webhook event IDs,
  //    so this window check prevents duplicate notifications from retried deliveries.
  const recentDuplicate = await prisma.notification.findFirst({
    where: {
      type: "TICKET_REPLIED",
      link: `/support/tickets/${payload.conversation.id}`,
      createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
    },
    select: { id: true },
  });
  if (recentDuplicate) return NextResponse.json({ ok: true });

  try {
    const contactEmail = await supportRepo.getContactEmail(payload.conversation.contact_id);
    if (!contactEmail) return NextResponse.json({ ok: true });

    const platformUser = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: { id: true, email: true },
    });
    if (!platformUser) return NextResponse.json({ ok: true });

    await createNotification({
      userId: platformUser.id,
      type: "TICKET_REPLIED",
      title: "New reply on your ticket",
      message: payload.content?.text ?? "An admin replied to your ticket.",
      link: `/support/tickets/${payload.conversation.id}`,
    });

    const ticketLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/support/tickets/${payload.conversation.id}`;
    sendEmail({
      to: platformUser.email,
      subject: "[Support] New reply on your ticket",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>New Reply on Your Ticket</h2>
          <p>An admin replied to your support ticket.</p>
          <p><a href="${ticketLink}">View in dashboard</a></p>
        </div>
      `,
    }).catch(() => {});
  } catch (err) {
    console.error("[Chatwoot Webhook] Error processing message:", err);
  }

  return NextResponse.json({ ok: true });
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}
