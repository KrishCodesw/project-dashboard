import { NextRequest, NextResponse } from "next/server";
import { resolveUserFromHeaders } from "@/lib/resolve-user";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, buildS3Key, s3Client } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUserFromHeaders(req.headers);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const category = (formData.get("category") as string | null) ?? "OTHER";
    const taskId = (formData.get("taskId") as string | null) ?? undefined;

    if (!file || !projectId) {
      return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
    }

    // Server-side file size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds 50 MB limit` },
        { status: 413 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const s3Key = buildS3Key(projectId, category, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const record = await prisma.projectFile.create({
      data: {
        projectId,
        taskId,
        uploadedBy: userId,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        s3Key,
        s3Url: s3Key,
        category: category as any,
      },
    });

    return NextResponse.json({ file: record });
  } catch (err) {
    console.error("[/api/upload]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
