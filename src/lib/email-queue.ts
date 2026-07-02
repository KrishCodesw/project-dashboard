import { EmailQueueStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const MAX_ATTEMPTS = 3;
const SEND_DELAY_MS = 200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processEmailQueue(batchSize = 50) {
  const pending = await prisma.emailQueue.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      to: true,
      subject: true,
      body: true,
      attempts: true,
    },
  });

  if (pending.length === 0) {
    return { picked: 0, sent: 0, failed: 0, requeued: 0 };
  }

  const pendingIds = pending.map((job) => job.id);

  await prisma.emailQueue.updateMany({
    where: {
      id: { in: pendingIds },
      status: "PENDING",
    },
    data: { status: "PROCESSING" },
  });

  const claimed = await prisma.emailQueue.findMany({
    where: {
      id: { in: pendingIds },
      status: "PROCESSING",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      to: true,
      subject: true,
      body: true,
      attempts: true,
    },
  });

  const results = await Promise.allSettled(
    claimed.map(async (job, index) => {
      await wait(index * SEND_DELAY_MS);
      await sendEmail({
        to: job.to,
        subject: job.subject,
        html: job.body,
        requireConfigured: true,
      });
      return job;
    })
  );

  let sent = 0;
  let failed = 0;
  let requeued = 0;

  await Promise.all(
    results.map(async (result, index) => {
      const job = claimed[index];
      if (!job) return;

      if (result.status === "fulfilled") {
        sent += 1;
        const sendResult = result.value as unknown as { messageId: string | null };
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: {
            status: EmailQueueStatus.SENT,
            messageId: sendResult.messageId,
            errorLog: null,
          },
        });
        return;
      }

      const nextAttempts = job.attempts + 1;
      const errorMessage =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason ?? "Unknown email send error");

      if (nextAttempts > MAX_ATTEMPTS) {
        failed += 1;
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: {
            attempts: nextAttempts,
            status: EmailQueueStatus.FAILED,
            errorLog: errorMessage.slice(0, 2000),
          },
        });
        return;
      }

      requeued += 1;
      await prisma.emailQueue.update({
        where: { id: job.id },
        data: {
          attempts: nextAttempts,
          status: EmailQueueStatus.PENDING,
          errorLog: errorMessage.slice(0, 2000),
        },
      });
    })
  );

  return {
    picked: claimed.length,
    sent,
    failed,
    requeued,
  };
}
