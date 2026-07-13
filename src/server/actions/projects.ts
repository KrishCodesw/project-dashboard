"use server";

import { prisma } from "@/lib/prisma";
import { requireCoeUser, requireRole } from "@/lib/coe-guard";
import { resolveStudent } from "@/lib/resolve-user";
import { deleteS3Object } from "@/lib/s3";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isInstitutionalEmail, getInstitutionalDomain } from "@/lib/validation";
import { createBulkNotifications } from "@/lib/notifications";
import { updateProjectCompletion } from "@/lib/completion";
import { buildPagination } from "@/lib/pagination";
import type { PaginatedResult } from "@/lib/pagination";

const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  domain: z.string(),      // Accepts any string from the frontend
  department: z.string(),  // Accepts any string from the frontend
  groupNo: z.string().regex(/^[a-zA-Z]{2}-[a-zA-Z]+(?:-[a-zA-Z]+)?-\d+$/, "Format must be YEAR-DEPT-DIV-GROUP"),
  isRblProject: z.boolean().default(false),
  startDate: z.string(),
  endDate: z.string(),
  maxGroupSize: z.number().min(1).max(10).default(4),
  tagIds: z.array(z.string()).optional(),
});

const adminUploadAssignmentsSchema = z.object({
  csvContent: z.string().min(1),
});

const requestEditSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(10),
  domain: z.string().min(2),
  department: z.string().min(2),
  startDate: z.string(),
  endDate: z.string(),
  maxGroupSize: z.number().min(1).max(10),
});

export async function requestProjectEdit(data: z.infer<typeof requestEditSchema>) {
  // Allow any authenticated user (Teacher/Student) to submit a request
  // Validation can be expanded here to ensure they belong to the project
  const validated = requestEditSchema.parse(data);

  const project = await prisma.project.findUnique({ where: { id: validated.projectId } });
  if (!project) throw new Error("Project not found");

  await prisma.project.update({
    where: { id: validated.projectId },
    data: {
      hasPendingEdit: true,
      pendingEditData: validated,
    },
  });

  revalidatePath(`/teacher/projects/${validated.projectId}`);
  revalidatePath(`/student/projects/${validated.projectId}`);
  revalidatePath("/admin/projects");
  return { ok: true };
}

export async function approveProjectEdit(projectId: string) {
  await requireAdminSession();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.pendingEditData) {
    throw new Error("No pending edits found for this project");
  }

  const edits = project.pendingEditData as any;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      title: edits.title,
      description: edits.description,
      domain: edits.domain,
      department: edits.department,
      startDate: new Date(edits.startDate),
      endDate: new Date(edits.endDate),
      maxGroupSize: edits.maxGroupSize,
      hasPendingEdit: false,
      // Prisma accepts Prisma.DbNull or Prisma.JsonNull, but standard null usually works for optional Json
      pendingEditData: null as any, 
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath(`/student/projects/${projectId}`);
  return { ok: true };
}

export async function rejectProjectEdit(projectId: string) {
  await requireAdminSession();

  await prisma.project.update({
    where: { id: projectId },
    data: {
      hasPendingEdit: false,
      pendingEditData: null as any,
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath(`/student/projects/${projectId}`);
  return { ok: true };
}

export async function requestProjectActivation(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  await prisma.project.update({
    where: { id: projectId },
    data: { hasPendingActivation: true },
  });

  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath("/admin/projects");
  revalidatePath("/teacher/projects");
  return { ok: true };
}

export async function approveProjectActivation(projectId: string) {
  await requireAdminSession();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.hasPendingActivation) {
    throw new Error("No pending activation request found for this project");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "ACTIVE",
      hasPendingActivation: false,
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath(`/student/projects/${projectId}`);
  revalidatePath("/teacher/projects");
  return { ok: true };
}

export async function rejectProjectActivation(projectId: string) {
  await requireAdminSession();

  await prisma.project.update({
    where: { id: projectId },
    data: { hasPendingActivation: false },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath("/teacher/projects");
  return { ok: true };
}

const adminUpdateProjectSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().min(10),
  domain: z.string().min(2),
  department: z.string().min(2),
  groupNo: z.string().regex(/^[a-zA-Z]{2}-[a-zA-Z]+(?:-[a-zA-Z]+)?-\d+$/).optional(),
  isRblProject: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"]),
  maxGroupSize: z.number().min(1).max(10),
  startDate: z.string(),
  endDate: z.string(),
});

const adminUpdateMentorSchema = z.object({
  projectId: z.string().min(1),
  teacherId: z.string().min(1),
});

const adminUpsertMemberSchema = z.object({
  projectId: z.string().min(1),
  studentIdentifier: z.string().min(1),
  role: z.enum(["LEAD", "MEMBER"]).default("MEMBER"),
});

const adminUpdateMemberRoleSchema = z.object({
  projectId: z.string().min(1),
  studentId: z.string().min(1),
  role: z.enum(["LEAD", "MEMBER"]),
});

const adminRemoveMemberSchema = z.object({
  projectId: z.string().min(1),
  studentId: z.string().min(1),
});

async function requireAdminSession() {
  const user = await requireRole("ADMIN");
  return user.id;
}

async function requireTeacherUser() {
  return requireRole("TEACHER");
}

async function requireStudentUser() {
  return requireRole("STUDENT");
}

type CsvAssignmentRow = {
  email: string;
  projectName: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current.trim());
  return out;
}

function parseAssignmentCsv(csvContent: string): CsvAssignmentRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const emailIndex = headers.findIndex((h) => h === "email");
  const projectNameIndex = headers.findIndex(
    (h) => h === "projectname" || h === "project_name" || h === "project name"
  );

  if (emailIndex === -1) {
    throw new Error("CSV must include an 'email' column.");
  }
  if (projectNameIndex === -1) {
    throw new Error("CSV must include a 'projectName' column.");
  }

  const rows: CsvAssignmentRow[] = [];
  for (const rawLine of lines.slice(1)) {
    const cols = parseCsvLine(rawLine);
    const rawEmail = cols[emailIndex]?.toLowerCase().trim();
    const projectName = cols[projectNameIndex]?.trim();
    if (!rawEmail) continue;
    if (!projectName) continue;

    const parsedEmail = z.string().email().safeParse(rawEmail);
    if (!parsedEmail.success) continue;

    rows.push({
      email: parsedEmail.data,
      projectName,
    });
  }

  if (rows.length === 0) {
    throw new Error("No valid rows found in CSV.");
  }

  const deduped = new Map<string, CsvAssignmentRow>();
  for (const row of rows) {
    deduped.set(`${row.email}::${row.projectName.toLowerCase()}`, row);
  }
  return Array.from(deduped.values());
}

function buildCoeLoginUrl(): string {
  const baseUrl = (process.env.COE_MAIN_URL || "https://tcetcercd.in").replace(/\/+$/, "");
  const dashboardUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${baseUrl}/login?callbackUrl=${encodeURIComponent(`${dashboardUrl}/student/projects`)}`;
}

function buildAssignmentEmailBody(projectTitle: string, loginOrRegisterUrl: string, invitedByName?: string): string {
  const invitedByLine = invitedByName
    ? `<p style="margin: 0 0 12px;">Invited by <strong>${invitedByName}</strong>.</p>`
    : "";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="color: #2563eb; margin-bottom: 12px;">Project Assignment Notification</h2>
      <p style="margin: 0 0 12px;">You have been assigned to <strong>${projectTitle}</strong>.</p>
      ${invitedByLine}
      <p style="margin: 0 0 12px;">Please log in to <strong>tcetcercd.in</strong> to join your project and get started.</p>
      <p style="margin: 0 0 12px;"><a href="${loginOrRegisterUrl}" style="color: #2563eb;">Log in to accept assignment</a></p>
      <p style="margin: 0; color: #6b7280; font-size: 13px;">If this assignment is unexpected, contact your administrator.</p>
    </div>
  `;
}

export async function adminUploadProjectAssignments(data: z.infer<typeof adminUploadAssignmentsSchema>) {
  const adminId = await requireAdminSession();
  const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } });
  const invitedByName = admin?.name || "Administrator";

  const validated = adminUploadAssignmentsSchema.parse(data);
  const rows = parseAssignmentCsv(validated.csvContent);

  const projects = await prisma.project.findMany({
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const projectsByLowerTitle = new Map<string, { id: string; title: string }>();
  for (const project of projects) {
    const key = project.title.toLowerCase().trim();
    // Prefer most recently updated project when duplicate titles exist.
    if (!projectsByLowerTitle.has(key)) {
      projectsByLowerTitle.set(key, project);
    }
  }

  const uniqueProjectNames = Array.from(
    new Set(rows.map((row) => row.projectName.trim()).filter(Boolean))
  );

  const missingProjectNames = uniqueProjectNames.filter(
    (name) => !projectsByLowerTitle.has(name.toLowerCase())
  );

  let createdProjects = 0;
  if (missingProjectNames.length > 0) {
    const now = new Date();
    const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const created = await Promise.all(
      missingProjectNames.map((projectName)  =>
        prisma.project.create({
          data: {
            title: projectName,
            description: `Auto-created from CSV import on ${now.toISOString().slice(0, 10)}.`,
            domain: "GENERAL",
            department: "GENERAL",
            groupNo: "XX-GEN-1", // Default placeholder for CSV created projects
            isRblProject: false,
            startDate: now,
            endDate,
            teacherId: adminId,
            maxGroupSize: 4,
          },
          select: { id: true, title: true },
        })
      )
    );

    createdProjects = created.length;
    for (const project of created) {
      projectsByLowerTitle.set(project.title.toLowerCase().trim(), project);
    }
  }

  const resolvedRows = rows.filter((row) => projectsByLowerTitle.has(row.projectName.toLowerCase().trim()));

  if (resolvedRows.length === 0) {
    throw new Error("No valid assignment rows found in CSV.");
  }

  const unresolvedRows = rows.length - resolvedRows.length;

  const emails = resolvedRows.map((row) => row.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const existingByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  const existingRows = resolvedRows.filter((row) => existingByEmail.has(row.email));
  const newRows = resolvedRows.filter((row) => !existingByEmail.has(row.email));

  if (existingRows.length > 0) {
    await prisma.projectMember.createMany({
      data: existingRows.map((row) => ({
        projectId: projectsByLowerTitle.get(row.projectName.toLowerCase().trim())!.id,
        studentId: existingByEmail.get(row.email)!.id,
        role: "MEMBER",
      })),
      skipDuplicates: true,
    });
  }

  if (newRows.length > 0) {
    await prisma.pendingProjectAssignment.createMany({
      data: newRows.map((row) => ({
        projectId: projectsByLowerTitle.get(row.projectName.toLowerCase().trim())!.id,
        email: row.email,
        name: null,
        memberRole: "MEMBER",
        invitedById: adminId,
      })),
      skipDuplicates: true,
    });
  }

  const actionUrl = buildCoeLoginUrl();
  const emailJobs = resolvedRows.map((row) => {
    const project = projectsByLowerTitle.get(row.projectName.toLowerCase().trim())!;

    return {
      to: row.email,
      subject: `Project Assignment: ${project.title}`,
      body: buildAssignmentEmailBody(project.title, actionUrl, invitedByName),
      status: "PENDING" as const,
    };
  });

  await prisma.emailQueue.createMany({ data: emailJobs });

  revalidatePath("/admin");
  revalidatePath("/admin/project-assignments");
  revalidatePath("/admin/email-logs");

  return {
    ok: true,
    totalRows: rows.length,
    matchedRows: resolvedRows.length,
    unresolvedRows,
    createdProjects,
    existingUsersAssigned: existingRows.length,
    invitedUsersQueued: newRows.length,
    emailsQueued: emailJobs.length,
  };
}

export async function getAdminAssignableProjects() {
  await requireAdminSession();

  return prisma.project.findMany({
    select: {
      id: true,
      title: true,
      domain: true,
      teacher: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
}

export async function getAdminProjectsManagementData(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  await requireAdminSession();

  const { page, pageSize, skip, take } = buildPagination({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
  });

  const where: any = {};
  if (params?.search) {
    const q = params.search;
    where.OR = [
      { title: { contains: q } },
      { domain: { contains: q } },
      { department: { contains: q } },
      { teacher: { name: { contains: q } } },
    ];
  }
  if (params?.status) {
    where.status = params.status;
  }

  const [projects, total, teachers, students] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        title: true,
        description: true,
        domain: true,
        department: true,
        status: true,
        groupNo: true,
        isRblProject: true,
        maxGroupSize: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
        hasPendingEdit: true,
        pendingEditData: true,
        hasPendingActivation: true,
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          select: {
            studentId: true,
            role: true,
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                rollNumber: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.count({ where }),
    prisma.user.findMany({
      where: { role: "TEACHER", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", isActive: true },
      select: { id: true, name: true, email: true, rollNumber: true },
      orderBy: { name: "asc" },
      take: 2000,
    }),
  ]);

  return {
    projects,
    teachers,
    students,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function adminUpdateProject(data: z.infer<typeof adminUpdateProjectSchema>) {
  await requireAdminSession();
  const validated = adminUpdateProjectSchema.parse(data);

  const project = await prisma.project.findUnique({ where: { id: validated.projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  await prisma.project.update({
    where: { id: validated.projectId },
    data: {
      title: validated.title,
      description: validated.description,
      domain: validated.domain,
      department: validated.department,
      groupNo: validated.groupNo,             // Added field
      isRblProject: validated.isRblProject,   // Added field
      status: validated.status,
      maxGroupSize: validated.maxGroupSize,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
    },
  });

  await updateProjectCompletion(validated.projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  revalidatePath(`/teacher/projects/${validated.projectId}`);
  revalidatePath(`/student/projects/${validated.projectId}`);

  return { ok: true };
}

export async function adminUpdateProjectMentor(data: z.infer<typeof adminUpdateMentorSchema>) {
  await requireAdminSession();
  const validated = adminUpdateMentorSchema.parse(data);

  const [project, teacher] = await Promise.all([
    prisma.project.findUnique({ where: { id: validated.projectId }, select: { id: true } }),
    prisma.user.findFirst({
      where: { id: validated.teacherId, role: "TEACHER", isActive: true },
      select: { id: true },
    }),
  ]);

  if (!project) {
    throw new Error("Project not found");
  }
  if (!teacher) {
    throw new Error("Teacher not found or inactive");
  }

  await prisma.project.update({
    where: { id: validated.projectId },
    data: { teacherId: validated.teacherId },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/teacher/projects/${validated.projectId}`);
  return { ok: true };
}

export async function adminAddProjectMember(data: z.infer<typeof adminUpsertMemberSchema>) {
  try {
    const adminId = await requireAdminSession();
    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true } });
    const invitedByName = admin?.name || "Administrator";
    const validated = adminUpsertMemberSchema.parse(data);

    const project = await prisma.project.findUnique({
      where: { id: validated.projectId },
      include: { members: true },
    });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Project status check
    if (project.status === "COMPLETED" || project.status === "ARCHIVED") {
      return { success: false, error: "This project is already completed or archived. You can't add new members." };
    }

    // Group size check including pending assignments
    const pendingCount = await prisma.pendingProjectAssignment.count({
      where: { projectId: validated.projectId, status: "PENDING" },
    });
    if (project.members.length + pendingCount >= project.maxGroupSize) {
      return { success: false, error: "This project has reached its maximum capacity." };
    }

    let student;
    try {
      student = await resolveStudent(validated.studentIdentifier);
    } catch {
      return {
        success: false,
        error: "Unable to verify student information. Please try again later.",
      };
    }

    if (student) {
      // Branch A: Student found
      if (project.members.some((member) => member.studentId === student.id)) {
        return { success: false, error: "Student is already a member of this project" };
      }
      if (validated.role === "LEAD") {
        await prisma.projectMember.updateMany({
          where: { projectId: validated.projectId, role: "LEAD" },
          data: { role: "MEMBER" },
        });
      }
      await prisma.projectMember.create({
        data: {
          projectId: validated.projectId,
          studentId: student.id,
          role: validated.role,
        },
      });
      revalidatePath("/admin/projects");
      revalidatePath(`/student/projects/${validated.projectId}`);
      return { success: true };
    }

    // Branch B: Student null — check if identifier is an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(validated.studentIdentifier)) {
      const normalizedEmail = validated.studentIdentifier.toLowerCase().trim();
      if (!isInstitutionalEmail(normalizedEmail)) {
        const domain = getInstitutionalDomain();
        return { success: false, error: `Please use a valid institutional email ending in @${domain}.` };
      }

      // Check duplicate pending
      const existingPending = await prisma.pendingProjectAssignment.findUnique({
        where: { projectId_email: { projectId: validated.projectId, email: normalizedEmail } },
      });
      if (existingPending) {
        return { success: false, error: "An invitation has already been sent to this email address." };
      }

      // Create pending assignment
      await prisma.pendingProjectAssignment.create({
        data: {
          projectId: validated.projectId,
          email: normalizedEmail,
          memberRole: validated.role,
          invitedById: adminId,
          status: "PENDING",
        },
      });

      // Queue email outside transaction
      await prisma.emailQueue.create({
        data: {
          to: normalizedEmail,
          subject: `Project Assignment: ${project.title}`,
          body: buildAssignmentEmailBody(
            project.title,
            buildCoeLoginUrl(),
            invitedByName
          ),
          status: "PENDING",
        },
      });

      revalidatePath("/admin/projects");
      return { success: true, pending: true };
    }

    // Branch C: Student null, identifier is NOT email
    return { success: false, error: "This student has not registered yet. Enter their institutional email to send them an invitation." };
  } catch (err: any) {
    console.error("adminAddProjectMember error:", err);
    return { success: false, error: err?.message || "Failed to add member" };
  }
}

export async function adminUpdateProjectMemberRole(data: z.infer<typeof adminUpdateMemberRoleSchema>) {
  await requireAdminSession();
  const validated = adminUpdateMemberRoleSchema.parse(data);

  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_studentId: {
        projectId: validated.projectId,
        studentId: validated.studentId,
      },
    },
    select: { projectId: true, studentId: true },
  });

  if (!member) {
    throw new Error("Project member not found");
  }

  if (validated.role === "LEAD") {
    await prisma.projectMember.updateMany({
      where: { projectId: validated.projectId, role: "LEAD" },
      data: { role: "MEMBER" },
    });
  }

  await prisma.projectMember.update({
    where: {
      projectId_studentId: {
        projectId: validated.projectId,
        studentId: validated.studentId,
      },
    },
    data: { role: validated.role },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/student/projects/${validated.projectId}`);
  return { ok: true };
}

export async function adminRemoveProjectMember(data: z.infer<typeof adminRemoveMemberSchema>) {
  await requireAdminSession();
  const validated = adminRemoveMemberSchema.parse(data);

  await prisma.projectMember.deleteMany({
    where: {
      projectId: validated.projectId,
      studentId: validated.studentId,
    },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/student/projects/${validated.projectId}`);
  return { ok: true };
}

export async function createProject(data: z.infer<typeof createProjectSchema>) {
  const user = await requireTeacherUser();

  const validated = createProjectSchema.parse(data);
  const project = await prisma.project.create({
    data: {
      title: validated.title,
      description: validated.description,
      domain: validated.domain,
      department: validated.department,
      groupNo: validated.groupNo,             // Added field
      isRblProject: validated.isRblProject,   // Added field
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      maxGroupSize: validated.maxGroupSize,
      teacherId: user.id,
      tags: validated.tagIds?.length
        ? { create: validated.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  revalidatePath("/teacher/projects");
  return project;
}

export async function updateProject(
  projectId: string,
  data: Partial<z.infer<typeof createProjectSchema>> & { status?: string }
) {
  const user = await requireTeacherUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.teacherId !== user.id) {
    throw new Error("Not found or unauthorized");
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.domain && { domain: data.domain }),
      ...(data.department && { department: data.department }),
      ...(data.groupNo && { groupNo: data.groupNo }),                             // Added field
      ...(typeof data.isRblProject === "boolean" && { isRblProject: data.isRblProject }), // Added field
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
      ...(data.maxGroupSize && { maxGroupSize: data.maxGroupSize }),
      ...(data.status && { status: data.status as any }),
    },
  });

  // Notify members about project update
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { studentId: true },
  });
  if (members.length > 0) {
    await createBulkNotifications(
      members.map((m) => m.studentId),
      {
        type: "PROJECT_UPDATED",
        title: "Project Updated",
        message: `${updated.title} has been updated`,
        link: `/student/projects/${projectId}`,
      }
    );
  }

  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath("/teacher/projects");
  return updated;
}

export async function deleteProject(projectId: string) {
  const user = await requireTeacherUser();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.teacherId !== user.id) {
    throw new Error("Not found or unauthorized");
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/teacher/projects");
}

export async function duplicateProject(projectId: string) {
  const user = await requireTeacherUser();

  const original = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tags: true, milestones: true },
  });

  if (!original || original.teacherId !== user.id) {
    throw new Error("Not found or unauthorized");
  }

  const clone = await prisma.project.create({
    data: {
      title: `${original.title} (Copy)`,
      description: original.description,
      domain: original.domain,
      department: original.department,
      groupNo: original.groupNo,             // Added field
      isRblProject: original.isRblProject,   // Added field
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 86400000),
      maxGroupSize: original.maxGroupSize,
      teacherId: user.id,
      tags: {
        create: original.tags.map((t) => ({ tagId: t.tagId })),
      },
    },
  });

  revalidatePath("/teacher/projects");
  return clone;
}

export async function addProjectMember(
  projectId: string,
  studentIdentifier: string,
  role: "LEAD" | "MEMBER" = "MEMBER"
): Promise<{ success: boolean; pending?: boolean; error?: string }> {
  try {
    const user = await requireTeacherUser();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project || project.teacherId !== user.id) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    // Project status check
    if (project.status === "COMPLETED" || project.status === "ARCHIVED") {
      return { success: false, error: "This project is already completed or archived. You can't add new members." };
    }

    // Group size check including pending assignments
    const pendingCount = await prisma.pendingProjectAssignment.count({
      where: { projectId, status: "PENDING" },
    });
    if (project.members.length + pendingCount >= project.maxGroupSize) {
      return { success: false, error: "This project has reached its maximum capacity." };
    }

    let student;
    try {
      student = await resolveStudent(studentIdentifier);
    } catch {
      return {
        success: false,
        error: "Unable to verify student information. Please try again later.",
      };
    }

    if (student) {
      if (project.members.some(m => m.studentId === student.id)) {
        return { success: false, error: "Student is already a member of this project" };
      }
      if (role === "LEAD") {
        await prisma.projectMember.updateMany({
          where: { projectId, role: "LEAD" },
          data: { role: "MEMBER" },
        });
      }
      await prisma.projectMember.create({
        data: { projectId, studentId: student.id, role },
      });
      revalidatePath(`/teacher/projects/${projectId}/members`);
      return { success: true };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(studentIdentifier)) {
      const normalizedEmail = studentIdentifier.toLowerCase().trim();
      if (!isInstitutionalEmail(normalizedEmail)) {
        const domain = getInstitutionalDomain();
        return { success: false, error: `Please use a valid institutional email ending in @${domain}.` };
      }

      // Check duplicate pending
      const existingPending = await prisma.pendingProjectAssignment.findUnique({
        where: { projectId_email: { projectId, email: normalizedEmail } },
      });
      if (existingPending) {
        return { success: false, error: "An invitation has already been sent to this email address." };
      }

      // Create pending assignment
      await prisma.pendingProjectAssignment.create({
        data: {
          projectId,
          email: normalizedEmail,
          memberRole: role,
          invitedById: user.id,
          status: "PENDING",
        },
      });

      // Queue email outside transaction
      await prisma.emailQueue.create({
        data: {
          to: normalizedEmail,
          subject: `Project Assignment: ${project.title}`,
          body: buildAssignmentEmailBody(
            project.title,
            buildCoeLoginUrl(),
            user.name
          ),
          status: "PENDING",
        },
      });

      revalidatePath(`/teacher/projects/${projectId}/members`);
      return { success: true, pending: true };
    }

    // Branch C: Student null, identifier is NOT email
    return { success: false, error: "This student has not registered yet. Enter their institutional email to send them an invitation." };
  } catch (err: any) {
    console.error("addProjectMember error:", err);
    return { success: false, error: err?.message || "Failed to add member" };
  }
}

export async function getPendingMembers(projectId: string) {
  const user = await requireCoeUser();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teacherId: true },
  });
  if (!project) return { success: false, pending: [], error: "Project not found" };
  if (user.role !== "ADMIN" && project.teacherId !== user.id) {
    return { success: false, pending: [], error: "Unauthorized" };
  }

  const pending = await prisma.pendingProjectAssignment.findMany({
    where: { projectId, status: "PENDING" },
    include: {
      invitedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    pending: pending.map((p) => ({
      id: p.id,
      email: p.email,
      memberRole: p.memberRole,
      status: p.status,
      invitedByName: p.invitedBy.name,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      deliveryStatus: p.deliveryStatus,
      bounceReason: p.bounceReason,
      lastBounceAt: p.lastBounceAt?.toISOString() ?? null,
    })),
  };
}

export async function cancelPendingAssignment(projectId: string, assignmentId: string) {
  const user = await requireCoeUser();
  const assignment = await prisma.pendingProjectAssignment.findUnique({
    where: { id: assignmentId },
    include: { project: { select: { teacherId: true } } },
  });
  if (!assignment || assignment.projectId !== projectId) {
    return { success: false, error: "Invitation not found." };
  }
  if (user.role !== "ADMIN" && assignment.project.teacherId !== user.id) {
    return { success: false, error: "Unauthorized" };
  }
  if (assignment.status !== "PENDING") {
    return { success: false, error: "Cannot cancel a resolved or cancelled invitation." };
  }

  await prisma.pendingProjectAssignment.delete({ where: { id: assignmentId } });

  revalidatePath(`/teacher/projects/${projectId}/members`);
  revalidatePath("/admin/projects");
  return { success: true };
}

export async function editPendingAssignment(projectId: string, assignmentId: string, newEmail: string) {
  const user = await requireCoeUser();
  const normalizedEmail = newEmail.toLowerCase().trim();

  if (!isInstitutionalEmail(normalizedEmail)) {
    const domain = getInstitutionalDomain();
    return { success: false, error: `Please use a valid institutional email ending in @${domain}.` };
  }

  const assignment = await prisma.pendingProjectAssignment.findUnique({
    where: { id: assignmentId },
    include: { project: { select: { teacherId: true, title: true } } },
  });
  if (!assignment || assignment.projectId !== projectId) {
    return { success: false, error: "Invitation not found." };
  }
  if (user.role !== "ADMIN" && assignment.project.teacherId !== user.id) {
    return { success: false, error: "Unauthorized" };
  }
  if (assignment.status !== "PENDING") {
    return { success: false, error: "Cannot edit a resolved or cancelled invitation." };
  }

  // Check if the new email belongs to a registered user
  const registeredUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  try {
    if (registeredUser) {
      // User exists — add directly as member, no invitation needed
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: true },
      });
      if (!project) {
        return { success: false, error: "Project not found." };
      }
      if (project.members.some(m => m.studentId === registeredUser.id)) {
        return { success: false, error: "This student is already a member of this project." };
      }
      if (project.members.length >= project.maxGroupSize) {
        return { success: false, error: "This project has reached its maximum capacity." };
      }
      if (assignment.memberRole === "LEAD") {
        await prisma.projectMember.updateMany({
          where: { projectId, role: "LEAD" },
          data: { role: "MEMBER" },
        });
      }
      await prisma.$transaction([
        prisma.pendingProjectAssignment.delete({ where: { id: assignmentId } }),
        prisma.projectMember.create({
          data: { projectId, studentId: registeredUser.id, role: assignment.memberRole },
        }),
      ]);
      revalidatePath(`/teacher/projects/${projectId}/members`);
      revalidatePath("/admin/projects");
      return { success: true };
    }

    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.pendingProjectAssignment.findUnique({
        where: { projectId_email: { projectId, email: normalizedEmail } },
      });
      if (duplicate) {
        throw new Error("An invitation has already been sent to this email address.");
      }

      const existingMember = await tx.projectMember.findFirst({
        where: {
          projectId,
          student: { email: normalizedEmail },
        },
      });
      if (existingMember) {
        throw new Error("This student is already a member of this project.");
      }

      await tx.pendingProjectAssignment.create({
        data: {
          projectId,
          email: normalizedEmail,
          memberRole: assignment.memberRole,
          invitedById: assignment.invitedById,
          status: "PENDING",
        },
      });

      await tx.pendingProjectAssignment.delete({
        where: { id: assignmentId },
      });

      await tx.emailQueue.create({
        data: {
          to: normalizedEmail,
          subject: `Project Assignment: ${assignment.project.title}`,
          body: buildAssignmentEmailBody(
            assignment.project.title,
            buildCoeLoginUrl(),
            user.name
          ),
          status: "PENDING",
        },
      });
    });

    revalidatePath(`/teacher/projects/${projectId}/members`);
    revalidatePath("/admin/projects");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Could not update the invitation. Please try again." };
  }
}

export async function resendPendingInvitation(projectId: string, assignmentId: string) {
  const user = await requireCoeUser();

  const assignment = await prisma.pendingProjectAssignment.findUnique({
    where: { id: assignmentId },
    include: { project: { select: { teacherId: true, title: true } } },
  });
  if (!assignment || assignment.projectId !== projectId) {
    return { success: false, error: "Invitation not found." };
  }
  if (user.role !== "ADMIN" && assignment.project.teacherId !== user.id) {
    return { success: false, error: "Unauthorized" };
  }

  const secondsSinceUpdate = Math.floor(
    (Date.now() - new Date(assignment.updatedAt).getTime()) / 1000
  );
  if (secondsSinceUpdate < 60) {
    return {
      success: false,
      error: "You can resend the invitation once every 60 seconds.",
      cooldownRemaining: 60 - secondsSinceUpdate,
    };
  }

  await prisma.$transaction([
    prisma.emailQueue.create({
      data: {
        to: assignment.email,
        subject: `Project Assignment: ${assignment.project.title}`,
        body: buildAssignmentEmailBody(
          assignment.project.title,
          buildCoeLoginUrl(),
          user.name
        ),
        status: "PENDING",
      },
    }),
    prisma.pendingProjectAssignment.update({
      where: { id: assignmentId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidatePath(`/teacher/projects/${projectId}/members`);
  revalidatePath("/admin/projects");
  return { success: true };
}

export async function removeProjectMember(projectId: string, studentId: string) {
  const user = await requireTeacherUser();

  await prisma.projectMember.deleteMany({
    where: { projectId, studentId },
  });

  revalidatePath(`/teacher/projects/${projectId}/members`);
}

export async function adminDeleteProject(projectId: string) {
  await requireAdminSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true },
  });

  if (!project) throw new Error("Project not found");

  // Attempt to delete S3 objects referenced by project files.
  for (const f of project.files ?? []) {
    if (f.s3Key) {
      try {
        await deleteS3Object(f.s3Key);
      } catch (err) {
        // Log and continue; DB deletion will still remove records.
        // eslint-disable-next-line no-console
        console.warn("Failed to delete S3 object:", f.s3Key, err);
      }
    }
  }

  // Delete project (cascades to related records via Prisma schema onDelete: Cascade)
  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  revalidatePath(`/teacher/projects/${projectId}`);
  revalidatePath(`/student/projects/${projectId}`);

  return { ok: true };
}

export async function setProjectLead(projectId: string, studentId: string) {
  await requireTeacherUser();

  await prisma.$transaction([
    prisma.projectMember.updateMany({
      where: { projectId, role: "LEAD" },
      data: { role: "MEMBER" },
    }),
    prisma.projectMember.update({
      where: { projectId_studentId: { projectId, studentId } },
      data: { role: "LEAD" },
    }),
  ]);

  revalidatePath(`/teacher/projects/${projectId}/members`);
}

export async function getTeacherProjects(
  teacherId: string,
  params?: { page?: number; pageSize?: number; search?: string; status?: string; rblFilter?: string },
): Promise<PaginatedResult<any>> {
  const { page, pageSize, skip, take } = buildPagination({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
  });

  const where: any = { teacherId };
  if (params?.status && params.status !== "ALL") where.status = params.status;
  if (params?.rblFilter === "RBL") where.isRblProject = true;
  else if (params?.rblFilter === "STANDARD") where.isRblProject = false;
  if (params?.search) {
    const q = params.search.toLowerCase();
    where.OR = [
      { title: { contains: q } },
      { domain: { contains: q } },
      { department: { contains: q } },
      { groupNo: { contains: q } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      include: {
        members: {
          include: {
            student: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: { include: { tag: true } },
        _count: {
          select: { tasks: true, milestones: true, reviews: true, files: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      teacher: {
        select: { id: true, name: true, email: true, department: true },
      },
      members: {
        include: {
          student: {
            select: { id: true, name: true, email: true, rollNumber: true, avatarUrl: true },
          },
        },
      },
      tags: { include: { tag: true } },
      _count: {
        select: { tasks: true, milestones: true, reviews: true, files: true },
      }, 
    },
  });
}

export async function getStudentProjects(
  studentId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<any>> {
  const { page, pageSize, skip, take } = buildPagination({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
  });

  const where = { members: { some: { studentId } } };

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      include: {
        teacher: {
          select: { id: true, name: true, department: true },
        },
        members: {
          include: {
            student: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        tags: { include: { tag: true } },
        _count: {
          select: { tasks: true, milestones: true, reviews: true, files: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getTeacherDashboardStats(teacherId: string) {
  const projects = await prisma.project.findMany({
    where: { teacherId },
    select: {
      status: true,
      completionPercentage: true,
    },
  });

  const reviewsDue = await prisma.review.count({
    where: {
      project: { teacherId },
      status: "SCHEDULED",
      scheduledAt: { lte: new Date(Date.now() + 7 * 86400000) },
    },
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const avgCompletion =
    totalProjects > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + p.completionPercentage, 0) / totalProjects
        )
      : 0;

  return { totalProjects, activeProjects, averageCompletion: avgCompletion, reviewsDue };
}

export async function getStudentDashboardStats(studentId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [projects, tasksDueToday, completedTasks, allTasks] = await Promise.all([
    prisma.projectMember.count({ where: { studentId } }),
    prisma.task.count({
      where: {
        assignedToId: studentId,
        dueDate: { gte: today, lt: tomorrow },
        status: { not: "DONE" },
      },
    }),
    prisma.task.count({ where: { assignedToId: studentId, status: "DONE" } }),
    prisma.task.count({ where: { assignedToId: studentId } }),
  ]);

  const overallProgress = allTasks > 0 ? Math.round((completedTasks / allTasks) * 100) : 0;

  return { totalProjects: projects, tasksDueToday, completedTasks, overallProgress };
}

export async function getAllTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export async function createTag(name: string, color: string) {
  await requireRole(["ADMIN", "TEACHER"]);

  return prisma.tag.create({ data: { name, color } });
}

const leaderUpdateDetailsSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["INHOUSE", "OUTHOUSE", "INDUSTRY_SPONSORED"]),
  category: z.enum(["APPLICATION", "MULTIDISCIPLINARY", "RESEARCH", "CORE"]),
  application: z.enum(["SOCIETY_USE", "GOVERNMENT_USE", "INSTITUTE_USE", "INDUSTRY_USE"]),
  outcome: z.enum(["PUBLICATION", "PATENT", "PRODUCT", "COPYRIGHT"]),
  poMapping: z.string().min(1, "PO Mapping is required"),
  psoMapping: z.string().min(1, "PSO Mapping is required"),
  sdg: z.enum([
    "GOAL_1_NO_POVERTY", "GOAL_2_ZERO_HUNGER", "GOAL_3_GOOD_HEALTH", 
    "GOAL_4_QUALITY_EDUCATION", "GOAL_5_GENDER_EQUALITY", "GOAL_6_CLEAN_WATER", 
    "GOAL_7_CLEAN_ENERGY", "GOAL_8_DECENT_WORK", "GOAL_9_INDUSTRY_INNOVATION", 
    "GOAL_10_REDUCED_INEQUALITIES", "GOAL_11_SUSTAINABLE_CITIES", "GOAL_12_RESPONSIBLE_CONSUMPTION", 
    "GOAL_13_CLIMATE_ACTION", "GOAL_14_LIFE_BELOW_WATER", "GOAL_15_LIFE_ON_LAND", 
    "GOAL_16_PEACE_AND_JUSTICE", "GOAL_17_PARTNERSHIPS"
  ]),
});

export async function updateLeaderProjectDetails(data: z.infer<typeof leaderUpdateDetailsSchema>) {
  const user = await requireStudentUser();

  const validated = leaderUpdateDetailsSchema.parse(data);

  // Security Check: Ensure the user is actually the LEAD of this project
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_studentId: {
        projectId: validated.projectId,
        studentId: user.id,
      },
    },
  });

  if (!membership || membership.role !== "LEAD") {
    throw new Error("Unauthorized: Only the Group Leader can update these details.");
  }

  const updatedProject = await prisma.project.update({
    where: { id: validated.projectId },
    data: {
      type: validated.type,
      category: validated.category,
      application: validated.application,
      outcome: validated.outcome,
      poMapping: validated.poMapping,
      psoMapping: validated.psoMapping,
      sdg: validated.sdg,
    },
  });

  revalidatePath(`/student/projects/${validated.projectId}`);
  revalidatePath('/rblprojects-te'); // Revalidate your public list board too
  
  return { ok: true, project: updatedProject };
}