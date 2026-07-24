"use server";

import { requireCoeUser, requireRole } from "@/lib/coe-guard";
import { prisma } from "@/lib/prisma";
import { generateAssetAccessUrl } from "@/lib/s3";
import { createBulkNotifications, createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { ShowcaseAssetKind, ShowcaseProjectDomain, ShowcaseProjectStatus } from "@prisma/client";
import { z } from "zod";
import { parseOrThrow } from "@/lib/zod-utils";

const teamMemberSchema = z.object({
  name: z.string().min(2),
  role: z.string().min(2),
});

const optionalTextSchema = z.string().trim().max(500).optional().or(z.literal(""));

const assetInputSchema = z.object({
  fileUrl: z
    .string()
    .trim()
    .min(1),
  fileName: z.string().min(1).max(180).optional(),
  fileType: z.string().min(1).max(120),
});

const showcasePayloadSchema = z.object({
  title: z.string().min(3),
  shortDescription: z.string().min(10).max(500),
  fullDescription: z.string().min(30),
  problemStatement: z.string().optional().default(""),
  objectives: z.string().optional().default(""),
  methodology: z.string().optional().default(""),
  keyFeatures: z.array(z.string().min(1)).default([]),
  techStack: z.array(z.string().min(1)).default([]),
  architectureDescription: z.string().optional().default(""),
  databaseUsed: z.string().optional().default(""),
  apiIntegrations: z.array(z.string().min(1)).default([]),
  githubUrl: z.string().url().optional().or(z.literal("")),
  liveDemoUrl: z.string().url().optional().or(z.literal("")),
  documentationUrl: optionalTextSchema,
  screenshots: z.array(assetInputSchema).default([]),
  documentationFiles: z.array(assetInputSchema).default([]),
  teamMembers: z.array(teamMemberSchema).default([]),
  mentorName: z.string().optional().default(""),
  mentorEmail: z.string().email().optional().or(z.literal("")),
  categories: z.array(z.string().min(1)).default([]),
  projectDomain: z.nativeEnum(ShowcaseProjectDomain).default("OTHER"),
  isPublic: z.boolean().default(false),
});

const updateSchema = showcasePayloadSchema.partial();

const feedbackSchema = z.object({
  message: z.string().min(2),
});

const statusTransition: Record<ShowcaseProjectStatus, ShowcaseProjectStatus[]> = {
  DRAFT: ["SUBMITTED", "REJECTED"],
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["SUBMITTED", "REJECTED"],
  RESUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: ["PUBLISHED", "REJECTED"],
  PUBLISHED: [],
  REJECTED: [],
};

function canTransition(from: ShowcaseProjectStatus, to: ShowcaseProjectStatus): boolean {
  return statusTransition[from].includes(to);
}

type CoeUser = {
  id: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
};

function assertSignedIn(user: CoeUser | null) {
  if (!user?.id) throw new Error("Unauthorized");
}

function assertAdmin(user: CoeUser) {
  if (user.role !== "ADMIN") throw new Error("Unauthorized");
}

function requireUserId(user: CoeUser): string {
  const userId = user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

function assertCreatorRole(user: CoeUser) {
  const role = user.role;
  if (role !== "STUDENT" && role !== "TEACHER") {
    throw new Error("Only students and teachers can create showcase projects");
  }
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim();
}

function countFilledSections(input: {
  fullDescription?: string;
  problemStatement?: string;
  objectives?: string;
  methodology?: string;
  keyFeatures?: string[];
  techStack?: string[];
  architectureDescription?: string;
  apiIntegrations?: string[];
}): number {
  const checks = [
    normalizeText(input.fullDescription).length >= 30,
    normalizeText(input.problemStatement).length > 0,
    normalizeText(input.objectives).length > 0,
    normalizeText(input.methodology).length > 0,
    (input.keyFeatures ?? []).length > 0,
    (input.techStack ?? []).length > 0,
    normalizeText(input.architectureDescription).length > 0,
    (input.apiIntegrations ?? []).length > 0,
  ];

  return checks.filter(Boolean).length;
}

function validateSubmissionReadiness(project: {
  title: string;
  shortDescription: string;
  fullDescription: string;
  problemStatement: string | null;
  objectives: string | null;
  methodology: string | null;
  keyFeatures: any;
  techStack: any;
  architectureDescription: string | null;
  apiIntegrations: any;
  githubUrl: string | null;
  documentationUrl: string | null;
  assets: Array<{ kind: ShowcaseAssetKind }>;
}) {
  if (!normalizeText(project.title)) {
    throw new Error("Title is required");
  }
  if (!normalizeText(project.shortDescription)) {
    throw new Error("Short description is required");
  }

  const sectionCount = countFilledSections({
    fullDescription: project.fullDescription,
    problemStatement: project.problemStatement ?? "",
    objectives: project.objectives ?? "",
    methodology: project.methodology ?? "",
    keyFeatures: (project.keyFeatures as string[]) ?? [],
    techStack: (project.techStack as string[]) ?? [],
    architectureDescription: project.architectureDescription ?? "",
    apiIntegrations: (project.apiIntegrations as string[]) ?? [],
  });

  if (sectionCount < 2) {
    throw new Error("At least 2 project sections must be filled before submission");
  }

  const hasGithub = normalizeText(project.githubUrl).length > 0;
  const hasDocumentationAsset = project.assets.some((asset) => asset.kind === "DOCUMENTATION");

  if (!hasGithub && !hasDocumentationAsset) {
    throw new Error("GitHub URL or uploaded documentation is required before submission");
  }
}

function buildSnapshot(project: any, teamMembers: any[], assets: any[]) {
  return {
    title: project.title,
    shortDescription: project.shortDescription,
    fullDescription: project.fullDescription,
    problemStatement: project.problemStatement,
    objectives: project.objectives,
    methodology: project.methodology,
    keyFeatures: project.keyFeatures,
    techStack: project.techStack,
    architectureDescription: project.architectureDescription,
    databaseUsed: project.databaseUsed,
    apiIntegrations: project.apiIntegrations,
    githubUrl: project.githubUrl,
    liveDemoUrl: project.liveDemoUrl,
    documentationUrl: project.documentationUrl,
    categories: project.categories,
    projectDomain: project.projectDomain,
    mentorName: project.mentorName,
    mentorEmail: project.mentorEmail,
    isPublic: project.isPublic,
    status: project.status,
    teamMembers,
    assets,
  };
}

async function getAdminIds() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  return admins.map((admin) => admin.id);
}

async function createVersionSnapshot(projectId: string, versionNumber: number) {
  const project = await prisma.showcaseProject.findUnique({
    where: { id: projectId },
    include: {
      teamMembers: { orderBy: { orderIndex: "asc" } },
      assets: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return prisma.projectVersion.create({
    data: {
      projectId,
      version: versionNumber,
      snapshot: buildSnapshot(project, project.teamMembers, project.assets),
    },
  });
}

function cleanArray(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function isLikelyS3Key(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;
  return true;
}

async function resolveAssetAccessUrl(fileUrl: string): Promise<string> {
  const trimmed = fileUrl.trim();
  if (!trimmed) return trimmed;

  if (isLikelyS3Key(trimmed)) {
    return generateAssetAccessUrl(trimmed, 900);
  }

  return trimmed;
}

async function mapAssetsWithAccessUrl<T extends { fileUrl: string }>(assets: T[]): Promise<Array<T & { accessUrl: string }>> {
  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      accessUrl: await resolveAssetAccessUrl(asset.fileUrl),
    }))
  );
}

export async function createProject(data: z.infer<typeof showcasePayloadSchema>) {
  const user = await requireCoeUser();
  assertSignedIn(user);
  assertCreatorRole(user);
  const userId = requireUserId(user);

  const validated = parseOrThrow(showcasePayloadSchema, data);

  const project = await prisma.showcaseProject.create({
    data: {
      title: validated.title,
      shortDescription: validated.shortDescription,
      fullDescription: validated.fullDescription,
      problemStatement: normalizeText(validated.problemStatement) || null,
      objectives: normalizeText(validated.objectives) || null,
      methodology: normalizeText(validated.methodology) || null,
      keyFeatures: cleanArray(validated.keyFeatures),
      techStack: cleanArray(validated.techStack),
      architectureDescription: normalizeText(validated.architectureDescription) || null,
      databaseUsed: normalizeText(validated.databaseUsed) || null,
      apiIntegrations: cleanArray(validated.apiIntegrations),
      githubUrl: normalizeText(validated.githubUrl) || null,
      liveDemoUrl: normalizeText(validated.liveDemoUrl) || null,
      documentationUrl: normalizeText(validated.documentationUrl) || null,
      categories: cleanArray(validated.categories),
      projectDomain: validated.projectDomain,
      mentorName: normalizeText(validated.mentorName) || null,
      mentorEmail: normalizeText(validated.mentorEmail) || null,
      isPublic: validated.isPublic,
      owner: { connect: { id: userId } },
      status: "DRAFT",
      currentVersion: 1,
      teamMembers: {
        create: validated.teamMembers.map((member, index) => ({
          name: member.name.trim(),
          role: member.role.trim(),
          orderIndex: index,
        })),
      },
      assets: {
        create: [
          ...validated.documentationFiles.map((asset) => ({
            kind: "DOCUMENTATION" as ShowcaseAssetKind,
            fileName: asset.fileName ?? null,
            fileType: asset.fileType,
            fileUrl: asset.fileUrl,
          })),
          ...validated.screenshots.map((asset) => ({
            kind: "SCREENSHOT" as ShowcaseAssetKind,
            fileName: asset.fileName ?? null,
            fileType: asset.fileType,
            fileUrl: asset.fileUrl,
          })),
        ],
      },
    },
    include: {
      assets: true,
    },
  });

  await createVersionSnapshot(project.id, 1);

  await prisma.showcaseProject.update({
    where: { id: project.id },
    data: { currentVersion: 2 },
  });

  revalidatePath("/showcase/my-projects");
  return project;
}

export async function updateProject(projectId: string, data: z.infer<typeof updateSchema>) {
  const user = await requireCoeUser();
  assertSignedIn(user);
  assertCreatorRole(user);
  const userId = requireUserId(user);

  const validated = parseOrThrow(updateSchema, data);

  const project = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== userId) {
    throw new Error("Project not found");
  }

  if (project.status === "PUBLISHED" || project.status === "REJECTED") {
    throw new Error("Project can no longer be edited");
  }

  await prisma.showcaseProject.update({
    where: { id: projectId },
    data: {
      ...(validated.title !== undefined ? { title: validated.title } : {}),
      ...(validated.shortDescription !== undefined ? { shortDescription: validated.shortDescription } : {}),
      ...(validated.fullDescription !== undefined ? { fullDescription: validated.fullDescription } : {}),
      ...(validated.problemStatement !== undefined
        ? { problemStatement: normalizeText(validated.problemStatement) || null }
        : {}),
      ...(validated.objectives !== undefined
        ? { objectives: normalizeText(validated.objectives) || null }
        : {}),
      ...(validated.methodology !== undefined
        ? { methodology: normalizeText(validated.methodology) || null }
        : {}),
      ...(validated.keyFeatures !== undefined ? { keyFeatures: cleanArray(validated.keyFeatures) } : {}),
      ...(validated.techStack !== undefined ? { techStack: cleanArray(validated.techStack) } : {}),
      ...(validated.architectureDescription !== undefined
        ? { architectureDescription: normalizeText(validated.architectureDescription) || null }
        : {}),
      ...(validated.databaseUsed !== undefined
        ? { databaseUsed: normalizeText(validated.databaseUsed) || null }
        : {}),
      ...(validated.apiIntegrations !== undefined
        ? { apiIntegrations: cleanArray(validated.apiIntegrations) }
        : {}),
      ...(validated.githubUrl !== undefined
        ? { githubUrl: normalizeText(validated.githubUrl) || null }
        : {}),
      ...(validated.liveDemoUrl !== undefined
        ? { liveDemoUrl: normalizeText(validated.liveDemoUrl) || null }
        : {}),
      ...(validated.documentationUrl !== undefined
        ? { documentationUrl: normalizeText(validated.documentationUrl) || null }
        : {}),
      ...(validated.categories !== undefined ? { categories: cleanArray(validated.categories) } : {}),
      ...(validated.projectDomain !== undefined ? { projectDomain: validated.projectDomain } : {}),
      ...(validated.mentorName !== undefined
        ? { mentorName: normalizeText(validated.mentorName) || null }
        : {}),
      ...(validated.mentorEmail !== undefined
        ? { mentorEmail: normalizeText(validated.mentorEmail) || null }
        : {}),
      ...(typeof validated.isPublic === "boolean" ? { isPublic: validated.isPublic } : {}),
    },
  });

  if (validated.teamMembers) {
    await prisma.showcaseTeamMember.deleteMany({ where: { projectId } });
    if (validated.teamMembers.length > 0) {
      await prisma.showcaseTeamMember.createMany({
        data: validated.teamMembers.map((member, index) => ({
          projectId,
          name: member.name.trim(),
          role: member.role.trim(),
          orderIndex: index,
        })),
      });
    }
  }

  if (validated.documentationFiles || validated.screenshots) {
    await prisma.projectAsset.deleteMany({ where: { projectId } });

    const documentationFiles = validated.documentationFiles ?? [];
    const screenshots = validated.screenshots ?? [];

    if (documentationFiles.length > 0 || screenshots.length > 0) {
      await prisma.projectAsset.createMany({
        data: [
          ...documentationFiles.map((asset) => ({
            projectId,
            kind: "DOCUMENTATION" as ShowcaseAssetKind,
            fileName: asset.fileName ?? null,
            fileType: asset.fileType,
            fileUrl: asset.fileUrl,
          })),
          ...screenshots.map((asset) => ({
            projectId,
            kind: "SCREENSHOT" as ShowcaseAssetKind,
            fileName: asset.fileName ?? null,
            fileType: asset.fileType,
            fileUrl: asset.fileUrl,
          })),
        ],
      });
    }
  }

  const latest = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!latest) {
    throw new Error("Project not found");
  }

  await createVersionSnapshot(projectId, latest.currentVersion);
  await prisma.showcaseProject.update({
    where: { id: projectId },
    data: { currentVersion: { increment: 1 } },
  });

  revalidatePath("/showcase/my-projects");
  revalidatePath(`/admin/showcase/${projectId}`);
  revalidatePath("/showcase");
  return latest;
}

export async function submitProject(projectId: string) {
  const user = await requireCoeUser();
  assertSignedIn(user);
  assertCreatorRole(user);
  const userId = requireUserId(user);

  const project = await prisma.showcaseProject.findUnique({
    where: { id: projectId },
    include: { assets: true, teamMembers: true },
  });

  if (!project || project.ownerId !== userId) {
    throw new Error("Project not found");
  }

  if (!canTransition(project.status, "SUBMITTED")) {
    throw new Error("Invalid status transition");
  }

  validateSubmissionReadiness(project);

  await createVersionSnapshot(project.id, project.currentVersion);

  const updated = await prisma.showcaseProject.update({
    where: { id: project.id },
    data: {
      status: "SUBMITTED",
      currentVersion: { increment: 1 },
    },
  });

  const adminIds = await getAdminIds();
  if (adminIds.length > 0) {
    await createBulkNotifications(adminIds, {
      type: "PROJECT_SUBMITTED",
      title: "New Showcase Submission",
      message: `${updated.title} was submitted for review`,
      link: `/admin/showcase/${updated.id}`,
    });
  }

  revalidatePath("/showcase/my-projects");
  revalidatePath("/admin/showcase");
  return updated;
}

export async function resubmitProject(projectId: string) {
  const user = await requireCoeUser();
  assertSignedIn(user);
  assertCreatorRole(user);
  const userId = requireUserId(user);

  const project = await prisma.showcaseProject.findUnique({
    where: { id: projectId },
    include: { assets: true },
  });

  if (!project || project.ownerId !== userId) {
    throw new Error("Project not found");
  }

  if (!canTransition(project.status, "SUBMITTED")) {
    throw new Error("Only projects with requested changes can be resubmitted");
  }

  validateSubmissionReadiness(project as any);

  await createVersionSnapshot(project.id, project.currentVersion);

  const updated = await prisma.showcaseProject.update({
    where: { id: project.id },
    data: {
      status: "SUBMITTED",
      currentVersion: { increment: 1 },
    },
  });

  const adminIds = await getAdminIds();
  if (adminIds.length > 0) {
    await createBulkNotifications(adminIds, {
      type: "PROJECT_SUBMITTED",
      title: "Showcase Resubmission",
      message: `${updated.title} was resubmitted after requested changes`,
      link: `/admin/showcase/${updated.id}`,
    });
  }

  revalidatePath("/showcase/my-projects");
  revalidatePath("/admin/showcase");
  return updated;
}

export async function getMyProjects() {
  const user = await requireCoeUser();
  assertSignedIn(user);
  const userId = requireUserId(user);

  return prisma.showcaseProject.findMany({
    where: { ownerId: userId },
    include: {
      teamMembers: { orderBy: { orderIndex: "asc" } },
      assets: true,
      versions: {
        orderBy: { version: "desc" },
        take: 8,
      },
      feedbacks: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
        take: 10,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectVersions(projectId: string) {
  const user = await requireCoeUser();
  assertSignedIn(user);
  const userId = requireUserId(user);
  const role = user.role;

  const project = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!project || (project.ownerId !== userId && role !== "ADMIN")) {
    throw new Error("Unauthorized");
  }

  return prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    include: {
      feedback: {
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      },
    },
  });
}

export async function getAllSubmissions(status?: ShowcaseProjectStatus | "ALL") {
  const user = await requireRole("ADMIN");
  assertAdmin(user);

  return prisma.showcaseProject.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    include: {
      owner: {
        select: { id: true, name: true, email: true, role: true },
      },
      teamMembers: true,
      versions: {
        orderBy: { version: "desc" },
        take: 2,
      },
      _count: {
        select: {
          feedbacks: true,
          assets: true,
          versions: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function startReview(projectId: string) {
  const user = await requireRole("ADMIN");
  assertAdmin(user);

  const project = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  if (project.status !== "SUBMITTED") {
    throw new Error("Only submitted projects can be moved to review");
  }

  const updated = await prisma.showcaseProject.update({
    where: { id: projectId },
    data: { status: "UNDER_REVIEW" },
  });

  revalidatePath("/admin/showcase");
  revalidatePath(`/admin/showcase/${projectId}`);
  return updated;
}

export async function addFeedback(projectId: string, versionId: string, data: z.infer<typeof feedbackSchema>) {
  const user = await requireRole("ADMIN");
  assertAdmin(user);
  const userId = requireUserId(user);

  const validated = parseOrThrow(feedbackSchema, data);
  const project = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const feedback = await prisma.reviewFeedback.create({
    data: {
      projectId,
      versionId,
      authorId: userId,
      message: validated.message,
    },
  });

  await createNotification({
    userId: project.ownerId,
    type: "FEEDBACK_ADDED",
    title: "Feedback added",
    message: `New review feedback added to ${project.title}`,
    link: `/showcase/my-projects`,
  });

  revalidatePath(`/admin/showcase/${projectId}`);
  revalidatePath("/showcase/my-projects");
  return feedback;
}

export async function resolveFeedback(feedbackId: string) {
  const user = await requireRole("ADMIN");
  assertAdmin(user);

  const updated = await prisma.reviewFeedback.update({
    where: { id: feedbackId },
    data: { isResolved: true },
  });

  revalidatePath("/admin/showcase");
  revalidatePath("/showcase/my-projects");
  return updated;
}

export async function requestChanges(projectId: string) {
  return changeStatus(projectId, "CHANGES_REQUESTED", {
    title: "Changes requested",
    message: "Admin requested updates before approval",
    notificationType: "CHANGES_REQUESTED",
  });
}

export async function approveProject(projectId: string) {
  return changeStatus(projectId, "APPROVED", {
    title: "Project approved",
    message: "Your showcase project has been approved",
    notificationType: "PROJECT_APPROVED",
  });
}

export async function publishProject(projectId: string) {
  return changeStatus(projectId, "PUBLISHED", {
    title: "Project published",
    message: "Your showcase project is now publicly visible",
    notificationType: "PROJECT_PUBLISHED",
  });
}

export async function rejectProject(projectId: string) {
  return changeStatus(projectId, "REJECTED", {
    title: "Project rejected",
    message: "Your showcase project was rejected",
    notificationType: "CHANGES_REQUESTED",
  });
}

export async function getSubmissionById(projectId: string) {
  const user = await requireRole("ADMIN");
  assertAdmin(user);

  const project = await prisma.showcaseProject.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: { id: true, name: true, email: true, role: true },
      },
      teamMembers: {
        orderBy: { orderIndex: "asc" },
      },
      versions: {
        orderBy: { version: "desc" },
        include: {
          feedback: {
            include: {
              author: {
                select: { id: true, name: true, role: true },
              },
            },
          },
        },
      },
      feedbacks: {
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      },
      assets: true,
    },
  });

  if (!project) {
    return null;
  }

  const assets = await mapAssetsWithAccessUrl(project.assets);
  return { ...project, assets };
}

export async function getPublicShowcaseProjects() {
  const projects = await prisma.showcaseProject.findMany({
    where: {
      status: "PUBLISHED",
      isPublic: true,
    },
    include: {
      owner: {
        select: {
          name: true,
        },
      },
      teamMembers: {
        orderBy: { orderIndex: "asc" },
      },
      assets: {
        where: { kind: "SCREENSHOT" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      assets: await mapAssetsWithAccessUrl(project.assets),
    }))
  );
}

export async function getPublicShowcaseProjectById(projectId: string) {
  const project = await prisma.showcaseProject.findFirst({
    where: {
      id: projectId,
      status: "PUBLISHED",
      isPublic: true,
    },
    include: {
      owner: {
        select: {
          name: true,
        },
      },
      teamMembers: {
        orderBy: { orderIndex: "asc" },
      },
      assets: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    return null;
  }

  const assets = await mapAssetsWithAccessUrl(project.assets);
  return { ...project, assets };
}

async function changeStatus(
  projectId: string,
  targetStatus: ShowcaseProjectStatus,
  options: { title: string; message: string; notificationType: any }
) {
  const user = await requireRole("ADMIN");
  assertAdmin(user);

  const project = await prisma.showcaseProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  if (!canTransition(project.status, targetStatus)) {
    throw new Error(`Invalid status transition from ${project.status} to ${targetStatus}`);
  }

  const updated = await prisma.showcaseProject.update({
    where: { id: projectId },
    data: {
      status: targetStatus,
      isPublic: targetStatus === "PUBLISHED" ? true : project.isPublic,
    },
  });

  await createNotification({
    userId: project.ownerId,
    type: options.notificationType,
    title: options.title,
    message: options.message,
    link: "/showcase/my-projects",
  });

  revalidatePath("/admin/showcase");
  revalidatePath(`/admin/showcase/${projectId}`);
  revalidatePath("/showcase/my-projects");
  revalidatePath("/showcase");

  return updated;
}
