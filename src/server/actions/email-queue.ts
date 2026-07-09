"use server";

import type { PaginatedResult } from "@/lib/pagination";
import { buildPagination } from "@/lib/pagination";
import { requireRole } from "@/lib/coe-guard";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { processEmailQueue } from "@/lib/email-queue";

export async function getEmailQueueLogs(
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<any>> {
  await requireRole("ADMIN");
  const { page, pageSize, skip, take } = buildPagination({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 50,
  });

  const [data, total] = await Promise.all([
    prisma.emailQueue.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        attempts: true,
        errorLog: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.emailQueue.count(),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function retryFailedEmails() {
  await requireRole("ADMIN");

  const result = await prisma.emailQueue.updateMany({
    where: { status: "FAILED" },
    data: {
      status: "PENDING",
      attempts: 0,
      errorLog: null,
    },
  });

  revalidatePath("/admin/email-logs");
  return { updated: result.count };
}

export async function runEmailQueueNow(batchSize = 50) {
  await requireRole("ADMIN");

  const result = await processEmailQueue(Math.min(Math.max(batchSize, 1), 200));
  revalidatePath("/admin/email-logs");
  return result;
}
