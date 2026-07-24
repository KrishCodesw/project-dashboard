"use server";

import { z } from "zod";
import { parseOrThrow } from "@/lib/zod-utils";
import { prisma } from "@/lib/prisma";
import { createBulkNotifications, createNotification } from "@/lib/notifications";
import { requireRole } from "@/lib/coe-guard";
import { revalidatePath } from "next/cache";
import { PublicationType, PublicationStatus, IndexingType } from "@prisma/client";

// Enums
const PublicationTypeEnum = z.enum(["PAPER", "PATENT", "BOOK_CHAPTER", "COPYRIGHT", "REVIEW"]);
const IndexingTypeEnum = z.enum(["SCOPUS", "SCI", "WEB_OF_SCIENCE", "UGC_CARE", "NONE"]);

// Schemas
const createPublicationSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  authors: z.array(z.string()).min(1, "At least one author is required"),
  publicationType: PublicationTypeEnum,
  subType: z.string().optional(),
  journalName: z.string().optional(),
  conferenceName: z.string().optional(),
  bookTitle: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  indexingType: IndexingTypeEnum.optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  publicationDate:z.coerce.date(),
  proofUrl: z.string().optional(),
  remarks: z.string().optional(),
});

const updatePublicationSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publicationType: PublicationTypeEnum.optional(),
  subType: z.string().optional(),
  journalName: z.string().optional(),
  conferenceName: z.string().optional(),
  bookTitle: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  indexingType: IndexingTypeEnum.optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  publicationDate: z.coerce.date().optional(),
  proofUrl: z.string().optional(),
  remarks: z.string().optional(),
});

const approveRejectSchema = z.object({
  publicationId: z.string().min(1),
});

// Actions
export async function createPublication(data: z.infer<typeof createPublicationSchema>) {
  const parsedData = parseOrThrow(createPublicationSchema, data);
  const user = await requireRole(["TEACHER", "STUDENT", "ADMIN"]);

  const project = await prisma.project.findUnique({
    where: { id: parsedData.projectId },
    select: { teacherId: true, title: true }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (user.role === "TEACHER" && project.teacherId !== user.id) {
    throw new Error("You are not the teacher for this project");
  }

  if (user.role === "STUDENT") {
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId: parsedData.projectId,
        studentId: user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      throw new Error("You are not a member of this project");
    }
  }

  const publication = await prisma.publication.create({
    data: {
      projectId: parsedData.projectId,
      title: parsedData.title,
      authors: parsedData.authors.join(", "), 
      publicationType: parsedData.publicationType,
      subType: parsedData.subType,
      indexingType: parsedData.indexingType || "NONE",
      uniqueIdentifier: parsedData.doi?.trim() || null, 
      detailsJson: {              
        journalName: parsedData.journalName,
        conferenceName: parsedData.conferenceName,
        bookTitle: parsedData.bookTitle,
        publisher: parsedData.publisher,
        volume: parsedData.volume,
        issue: parsedData.issue,
        pages: parsedData.pages,
        proofUrl: parsedData.proofUrl,
        remarks: parsedData.remarks,
      },
      publicationDate: parsedData.publicationDate,
      enteredById: user.id,       
      status: PublicationStatus.PENDING,
    },
  });

  const adminIds = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (adminIds.length > 0) {
    await createBulkNotifications(
      adminIds.map((admin) => admin.id),
      {
        type: "PROJECT_UPDATED",
        title: "Publication draft added",
        message: `A new publication draft was added to ${project.title}`,
        link: "/admin/projects?publications=all",
      }
    );
  }

  revalidatePath(`/teacher/projects/${parsedData.projectId}`);
  return publication;
}

export async function updatePublication(data: z.infer<typeof updatePublicationSchema>) {
  const parsedData = parseOrThrow(updatePublicationSchema, data);
  const user = await requireRole(["TEACHER"]);

  const publication = await prisma.publication.findUnique({
    where: { id: parsedData.id },
  });

  if (!publication) {
    throw new Error("Publication not found");
  }

  if (publication.enteredById !== user.id || publication.status !== PublicationStatus.PENDING) {
    throw new Error("Cannot update this publication");
  }

  const newDetails = {
    journalName: parsedData.journalName,
    conferenceName: parsedData.conferenceName,
    bookTitle: parsedData.bookTitle,
    publisher: parsedData.publisher,
    volume: parsedData.volume,
    issue: parsedData.issue,
    pages: parsedData.pages,
    proofUrl: parsedData.proofUrl,
    remarks: parsedData.remarks,
  };

  // Strip undefined values to prevent overwriting existing valid properties
  const providedDetails = Object.fromEntries(
    Object.entries(newDetails).filter(([_, v]) => v !== undefined)
  );

  const updatedDetailsJson = {
    ...(publication.detailsJson as object || {}),
    ...providedDetails,
  };

  const updated = await prisma.publication.update({
    where: { id: parsedData.id },
    data: {
      title: parsedData.title,
      authors: parsedData.authors ? parsedData.authors.join(", ") : undefined,
      publicationType: parsedData.publicationType,
      subType: parsedData.subType,
      indexingType: parsedData.indexingType,
      uniqueIdentifier: parsedData.doi?.trim() || null,
      detailsJson: updatedDetailsJson,
      publicationDate: parsedData.publicationDate,
    },
  });

  revalidatePath(`/teacher/projects/${publication.projectId}`);
  revalidatePath(`/student/projects/${publication.projectId}`);

  return updated;
}

export async function approvePublication(data: z.infer<typeof approveRejectSchema>) {
  const parsedData = parseOrThrow(approveRejectSchema, data);
  const user = await requireRole(["ADMIN"]); 

  const publication = await prisma.publication.findUnique({
    where: { id: parsedData.publicationId }
  });

  if (!publication) {
    throw new Error("Publication not found");
  }

  const score = await calculatePublicationScore(publication.publicationType, publication.subType ?? undefined);

  const updated = await prisma.publication.update({
    where: { id: parsedData.publicationId },
    data: {
      status: PublicationStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
      score, 
    },
  });

  const project = await prisma.project.findUnique({
    where: { id: publication.projectId },
    select: {
      id: true,
      title: true,
      teacherId: true,
      members: { select: { studentId: true } },
    },
  });

  if (project) {
    await createNotification({
      userId: project.teacherId,
      type: "PROJECT_UPDATED",
      title: "Publication approved",
      message: `A publication draft for ${project.title} was approved`,
      link: `/teacher/projects/${project.id}?tab=publications`,
    });

    const studentIds = project.members.map((member) => member.studentId);
    if (studentIds.length > 0) {
      await createBulkNotifications(studentIds, {
        type: "PROJECT_UPDATED",
        title: "Publication approved",
        message: `A publication draft for ${project.title} was approved`,
        link: `/student/projects/${project.id}?tab=publications`,
      });
    }

    revalidatePath(`/student/projects/${project.id}`);
  }

  revalidatePath(`/teacher/projects/${publication.projectId}`);
  revalidatePath(`/publications`);

  return updated;
}

export async function rejectPublication(data: z.infer<typeof approveRejectSchema>) {
  const parsedData = parseOrThrow(approveRejectSchema, data);
  const user = await requireRole(["ADMIN"]);

  const publication = await prisma.publication.findUnique({
    where: { id: parsedData.publicationId }
  });

  if (!publication) {
    throw new Error("Publication not found");
  }

  const updated = await prisma.publication.update({
    where: { id: parsedData.publicationId },
    data: {
      status: PublicationStatus.REJECTED,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  revalidatePath(`/teacher/projects/${publication.projectId}`);

  return updated;
}

export async function getProjectPublications(projectId: string) {
  const user = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);

  if (user.role === "STUDENT") {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_studentId: {
          projectId,
          studentId: user.id,
        },
      },
    });
    if (!membership) {
      throw new Error("Access denied");
    }
  }

  if (user.role === "TEACHER") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teacherId: true },
    });
    if (!project || project.teacherId !== user.id) {
      throw new Error("Access denied");
    }
  }

  return prisma.publication.findMany({
    where: { projectId },
    include: {
      enteredBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllPublications(status?: "APPROVED" | "ALL") {
  await requireRole(["ADMIN", "TEACHER", "STUDENT"]);

  const where = status === "APPROVED" ? { status: PublicationStatus.APPROVED } : {};

  return prisma.publication.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          title: true,
          teacher: { select: { name: true } },
          members: {
            select: {
              student: { select: { name: true } },
            },
          },
        },
      },
      enteredBy: { select: { id: true, name: true } },
    },
    orderBy: { publicationDate: "desc" },
  });
}

export async function getPendingPublicationsCount() {
  await requireRole(["ADMIN"]);

  return prisma.publication.count({
    where: { status: PublicationStatus.PENDING },
  });
}

export async function getUserPublications(userId: string) {
  const user = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);

  if (user.role !== "ADMIN" && user.id !== userId) {
    throw new Error("Access denied");
  }

  return prisma.publication.findMany({
    where: { enteredById: userId }, 
    include: {
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectPublicationSummary(projectId: string) {
  const user = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);

  if (user.role === "STUDENT") {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_studentId: {
          projectId,
          studentId: user.id,
        },
      },
    });
    if (!membership) throw new Error("Access denied");
  } else if (user.role === "TEACHER") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teacherId: true },
    });
    if (!project || project.teacherId !== user.id) throw new Error("Access denied");
  }

  const publications = await prisma.publication.findMany({
    where: { projectId, status: PublicationStatus.APPROVED },
    select: { score: true },
  });

  const totalScore = publications.reduce((sum, pub) => sum + (pub.score || 0), 0);

  const memberCount = await prisma.projectMember.count({
    where: { projectId },
  });

  return {
    totalPublications: publications.length,
    approvedPublications: publications.length,
    totalScore,
    studentScore: memberCount > 0 ? totalScore / memberCount : 0,
  };
}

export async function calculatePublicationScore(publicationType: string, subType?: string): Promise<number> {
  const config = await prisma.publicationScoreConfig.findUnique({
    where: {
      publicationType_subType: {
        publicationType: publicationType as PublicationType,
        subType: subType || "",
      },
    },
  });

  return config?.score || 0;
}

export async function seedPublicationScoreConfigs() {
  const configs = [
    { publicationType: PublicationType.PAPER, subType: "Indexed", score: 10 },
    { publicationType: PublicationType.PAPER, subType: "Non-Indexed", score: 6 },
    { publicationType: PublicationType.REVIEW, subType: "", score: 5 },
    { publicationType: PublicationType.BOOK_CHAPTER, subType: "", score: 8 },
    { publicationType: PublicationType.PATENT, subType: "Filed", score: 10 },
    { publicationType: PublicationType.PATENT, subType: "Published", score: 15 },
    { publicationType: PublicationType.PATENT, subType: "Granted", score: 25 },
    { publicationType: PublicationType.COPYRIGHT, subType: "", score: 4 },
  ];

  for (const config of configs) {
    await prisma.publicationScoreConfig.upsert({
      where: {
        publicationType_subType: {
          publicationType: config.publicationType,
          subType: config.subType,
        },
      },
      update: { score: config.score },
      create: config,
    });
  }
}