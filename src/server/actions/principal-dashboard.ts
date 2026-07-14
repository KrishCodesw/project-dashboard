"use server";

import { prisma } from "@/lib/prisma";
import { requirePrincipal } from "@/lib/coe-guard";
import { cached } from "@/lib/cache";

const CACHE_TTL_MS = 45_000;

export async function getPrincipalDashboardData() {
  await requirePrincipal();

  return cached("principal-dashboard", CACHE_TTL_MS, async () => {
    // ──────────────────────────────────────────────
    // 1. Project Analytics
    // ──────────────────────────────────────────────
    const [
      statusBreakdown,
      domainBreakdown,
      typeBreakdown,
      categoryBreakdown,
      sdgBreakdown,
      rblBreakdown,
      projectDates,
    ] = await Promise.all([
      prisma.project.groupBy({ by: ["status"], _count: true }),
      prisma.project.groupBy({
        by: ["domain"],
        _count: true,
        orderBy: { _count: { domain: "desc" } },
        take: 10,
      }),
      prisma.project.groupBy({ by: ["type"], _count: true }),
      prisma.project.groupBy({ by: ["category"], _count: true }),
      prisma.project.groupBy({ by: ["sdg"], _count: true, orderBy: { _count: { sdg: "desc" } }, take: 8 }),
      prisma.project.groupBy({ by: ["isRblProject"], _count: true }),
      prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as count
        FROM projects
        WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month ASC
      `,
    ]);

    const totalProjects = statusBreakdown.reduce((s, d) => s + d._count, 0);
    const activeProjects = statusBreakdown.find((s) => s.status === "ACTIVE")?._count ?? 0;
    const completedProjects = statusBreakdown.find((s) => s.status === "COMPLETED")?._count ?? 0;

    const projectTrend = projectDates.map((m) => ({ month: m.month, count: Number(m.count) }));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentProjects, recentReviews] = await Promise.all([
      prisma.project.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    // ──────────────────────────────────────────────
    // 2. Task & Milestone Analytics
    // ──────────────────────────────────────────────
    const [taskStatusBreakdown, totalMilestones, completedMilestones] =
      await Promise.all([
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.milestone.count(),
        prisma.milestone.count({ where: { isCompleted: true } }),
      ]);

    const totalTasks = taskStatusBreakdown.reduce((s, t) => s + t._count, 0);
    const completedTasks = taskStatusBreakdown.find((t) => t.status === "DONE")?._count ?? 0;
    const inProgressTasks = taskStatusBreakdown.find((t) => t.status === "IN_PROGRESS")?._count ?? 0;

    // ──────────────────────────────────────────────
    // 3. Review Analytics
    // ──────────────────────────────────────────────
    const [reviewCount, completedReviewCount] = await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { status: "COMPLETED" } }),
    ]);

    // ──────────────────────────────────────────────
    // 4. User & Guide Analytics
    // ──────────────────────────────────────────────
    const [userCounts, guideGroup, projectCountsByTeacher] = await Promise.all([
      prisma.user.groupBy({
        by: ["role"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.departmentGuide.groupBy({ by: ["department"], _count: true }),
      prisma.project.groupBy({ by: ["teacherId"], _count: true }),
    ]);

    const totalStudents = userCounts.find((u) => u.role === "STUDENT")?._count ?? 0;
    const totalTeachers = userCounts.find((u) => u.role === "TEACHER")?._count ?? 0;
    const totalGuideCount = guideGroup.reduce((s, g) => s + g._count, 0);

    // Guide workload
    const guideUserIds = await prisma.departmentGuide.findMany({
      select: { userId: true, department: true },
    });
    const userIds = [...new Set(guideUserIds.map((g) => g.userId))];
    const guideNames = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(guideNames.map((u) => [u.id, u.name]));
    const teacherProjectMap = new Map(projectCountsByTeacher.map((p) => [p.teacherId, p._count]));

    const guideLoad = guideUserIds.map((g) => ({
      name: nameMap.get(g.userId) ?? "Unknown",
      projects: teacherProjectMap.get(g.userId) ?? 0,
    }));

    // Student participation: members per project
    const memberCounts = await prisma.projectMember.groupBy({ by: ["projectId"], _count: true });
    const memberDistribution = [0, 0, 0, 0, 0];
    for (const m of memberCounts) {
      const idx = Math.min(m._count, 4);
      memberDistribution[idx]++;
    }

    // ──────────────────────────────────────────────
    // 5. Publication & Showcase Analytics
    // ──────────────────────────────────────────────
    const [publicationCounts, showcaseCounts] = await Promise.all([
      prisma.publication.groupBy({ by: ["status"], _count: true }),
      prisma.showcaseProject.groupBy({ by: ["status"], _count: true }),
    ]);

    const pendingPublications = publicationCounts.find((p) => p.status === "PENDING")?._count ?? 0;
    const approvedPublications = publicationCounts.find((p) => p.status === "APPROVED")?._count ?? 0;
    const publishedShowcase = showcaseCounts.find((s) => s.status === "PUBLISHED")?._count ?? 0;

    // ──────────────────────────────────────────────
    // 6. Department Analytics (guide-based approach)
    // ──────────────────────────────────────────────
    const deptConfigs = await prisma.departmentConfiguration.findMany({ where: { isActive: true } });
    const activeDepts = deptConfigs.length;

    // Group guide assignments by department
    const guideByDept = new Map<string, string[]>();
    for (const g of guideUserIds) {
      const list = guideByDept.get(g.department) ?? [];
      list.push(g.userId);
      guideByDept.set(g.department, list);
    }

    // Get all project IDs managed by any guide
    const allGuideIds = [...new Set(guideUserIds.map((g) => g.userId))];
    const guideProjects = allGuideIds.length > 0
      ? await prisma.project.findMany({
          where: { teacherId: { in: allGuideIds } },
          select: {
            id: true, status: true, teacherId: true,
          },
        })
      : [];
    const allProjectIds = guideProjects.map((p) => p.id);

    // Count members per project
    const memberCountsByProject = allProjectIds.length > 0
      ? await prisma.projectMember.groupBy({
          by: ["projectId"],
          where: { projectId: { in: allProjectIds } },
          _count: true,
        })
      : [];
    const memberCountByProjectId = new Map(memberCountsByProject.map((m) => [m.projectId, m._count]));

    // Count tasks per project
    const taskCountsByProject = allProjectIds.length > 0
      ? await prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: allProjectIds } },
          _count: true,
        })
      : [];
    const taskStatsByProject = new Map<string, { total: number; done: number }>();
    for (const t of taskCountsByProject) {
      const s = taskStatsByProject.get(t.projectId) ?? { total: 0, done: 0 };
      s.total += t._count;
      if (t.status === "DONE") s.done += t._count;
      taskStatsByProject.set(t.projectId, s);
    }

    // Build per-department stats
    const deptMap = new Map<string, {
      guideCount: number; projectCount: number; activeCount: number;
      completedCount: number; studentCount: number; totalTasks: number;
      doneTasks: number;
    }>();

    // Initialize from configs
    for (const config of deptConfigs) {
      deptMap.set(config.department, {
        guideCount: 0, projectCount: 0, activeCount: 0,
        completedCount: 0, studentCount: 0, totalTasks: 0, doneTasks: 0,
      });
    }

    // Fill guide counts
    for (const [dept, ids] of guideByDept) {
      const s = deptMap.get(dept);
      if (s) s.guideCount = ids.length;
    }

    // Fill project counts by matching projects to guide departments
    const teacherDeptMap = new Map(guideUserIds.map((g) => [g.userId, g.department]));
    for (const p of guideProjects) {
      const dept = teacherDeptMap.get(p.teacherId);
      if (!dept) continue;
      const s = deptMap.get(dept);
      if (!s) continue;
      s.projectCount++;
      if (p.status === "ACTIVE") s.activeCount++;
      if (p.status === "COMPLETED") s.completedCount++;

      const members = memberCountByProjectId.get(p.id) ?? 0;
      s.studentCount += members;

      const taskStats = taskStatsByProject.get(p.id);
      if (taskStats) {
        s.totalTasks += taskStats.total;
        s.doneTasks += taskStats.done;
      }
    }

    // Also add departments that have guides but no config
    for (const [dept, ids] of guideByDept) {
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          guideCount: ids.length, projectCount: 0, activeCount: 0,
          completedCount: 0, studentCount: 0, totalTasks: 0, doneTasks: 0,
        });
      }
    }
    // Recalculate activeDepts to include guide-based departments
    const adjustedDepts = deptMap.size;

    const departmentComparison = Array.from(deptMap.entries())
      .map(([department, s]) => ({
        department,
        projectCount: s.projectCount,
        guideCount: s.guideCount,
        studentCount: s.studentCount,
        totalTasks: s.totalTasks,
        doneTasks: s.doneTasks,
        activeCount: s.activeCount,
        completedCount: s.completedCount,
        completionRate: s.projectCount > 0 ? Math.round((s.completedCount / s.projectCount) * 100) : 0,
        taskCompletionRate: s.totalTasks > 0 ? Math.round((s.doneTasks / s.totalTasks) * 100) : 0,
      }))
      .sort((a, b) => b.projectCount - a.projectCount);

    // ──────────────────────────────────────────────
    // 7. Return
    // ──────────────────────────────────────────────
    return {
      totalProjects,
      totalGuideCount,
      totalStudents,
      totalTeachers,
      activeDepts: adjustedDepts,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalMilestones,
      completedMilestones,
      reviewCount,
      completedReviewCount,
      pendingPublications,
      approvedPublications,
      publishedShowcase,
      recentProjects,
      recentReviews,
      statusBreakdown: statusBreakdown.map((s) => ({ name: s.status, value: s._count })),
      domainBreakdown: domainBreakdown.filter((d) => d.domain).map((d) => ({ name: d.domain!, value: d._count })),
      typeBreakdown: typeBreakdown.filter((t) => t.type).map((t) => ({ name: t.type!, value: t._count })),
      categoryBreakdown: categoryBreakdown.filter((c) => c.category).map((c) => ({ name: c.category!, value: c._count })),
      sdgBreakdown: sdgBreakdown.filter((s) => s.sdg).map((s) => ({ name: s.sdg!, value: s._count })),
      rblBreakdown: rblBreakdown.map((r) => ({ name: r.isRblProject ? "RBL" : "Non-RBL", value: r._count })),
      projectTrend,
      guideLoad,
      memberDistribution: memberDistribution.map((count, i) => ({
        name: i === 4 ? "4+" : String(i),
        value: count,
      })),
      departmentComparison,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────────────────────────────
export type WorkLogEntry = {
  facultyId: string;
  facultyName: string;
  department: string | null;
  summary: string;
  submittedAt: Date;
};

export type ActivityFeedDay = {
  date: string;
  workLogs: WorkLogEntry[];
  newProjects: number;
  newFiles: number;
  newReviews: number;
  hasActivity: boolean;
};

export async function getDailyActivityFeed(dateStr?: string): Promise<ActivityFeedDay> {
  await requirePrincipal();

  const target = dateStr ? new Date(dateStr) : new Date();
  target.setHours(0, 0, 0, 0);
  const nextDay = new Date(target);
  nextDay.setDate(target.getDate() + 1);
  // local-timezone date string (toISOString() shifts IST→UTC rolling back a day)
  const isoDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

  const [workLogs, newProjects, newFiles, newReviews] = await Promise.all([
    prisma.facultyWorkLog.findMany({
      where: { date: { gte: target, lt: nextDay } },
      include: { faculty: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.project.count({ where: { createdAt: { gte: target, lt: nextDay } } }),
    prisma.projectFile.count({ where: { uploadedAt: { gte: target, lt: nextDay } } }),
    prisma.review.count({ where: { createdAt: { gte: target, lt: nextDay } } }),
  ]);

  const entries: WorkLogEntry[] = workLogs.map((l) => ({
    facultyId:   l.facultyId,
    facultyName: l.faculty.name,
    department:  l.department,
    summary:     l.summary,
    submittedAt: l.createdAt,
  }));

  return {
    date: isoDate,
    workLogs: entries,
    newProjects,
    newFiles,
    newReviews,
    hasActivity: entries.length > 0 || newProjects > 0 || newFiles > 0 || newReviews > 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// DEPARTMENT WORKLOAD
// ─────────────────────────────────────────────────────────────────
export type DeptWorkloadRow = {
  department: string;
  totalIntake: number;
  projectCount: number;
  activeProjects: number;
  guideCount: number;
  studentCount: number;
  completionRate: number;
};

export async function getDepartmentWorkload(): Promise<DeptWorkloadRow[]> {
  await requirePrincipal();

  const { getCurrentAcademicYear } = await import('@/lib/academic-year');
  const year = getCurrentAcademicYear();

  // 1. Fetch active department configurations
  const configs = await prisma.departmentConfiguration.findMany({
    where: { isActive: true, academicYear: year },
    select: { department: true, studentCount: true, totalIntake: true },
  });

  // 2. Fetch all guides and map them to their departments
  const guides = await prisma.departmentGuide.findMany({
    select: { userId: true, department: true },
  });

  const teacherDeptMap = new Map<string, string>();
  const guideCountsByDept = new Map<string, number>();

  for (const g of guides) {
    teacherDeptMap.set(g.userId, g.department);
    guideCountsByDept.set(g.department, (guideCountsByDept.get(g.department) || 0) + 1);
  }

  const guideIds = Array.from(teacherDeptMap.keys());

  // 3. Fetch all projects assigned to these guides
  const projects = guideIds.length > 0
    ? await prisma.project.findMany({
        where: { teacherId: { in: guideIds } },
        select: { status: true, teacherId: true },
      })
    : [];

  // 4. Aggregate project counts by the guide's mapped department
  const projectStatsByDept = new Map<string, { total: number; active: number; completed: number }>();

  for (const p of projects) {
    if (!p.teacherId) continue;
    const dept = teacherDeptMap.get(p.teacherId);
    if (!dept) continue;

    const stats = projectStatsByDept.get(dept) || { total: 0, active: 0, completed: 0 };
    stats.total += 1;
    if (p.status === 'ACTIVE') stats.active += 1;
    if (p.status === 'COMPLETED') stats.completed += 1;
    projectStatsByDept.set(dept, stats);
  }

  // 5. Build the final payload matched against the configurations
  return configs
    .map((c) => {
      const stats = projectStatsByDept.get(c.department) || { total: 0, active: 0, completed: 0 };
      const guideCount = guideCountsByDept.get(c.department) || 0;

      return {
        department: c.department,
        totalIntake: c.totalIntake ?? 0,
        projectCount: stats.total,
        activeProjects: stats.active,
        guideCount: guideCount,
        studentCount: c.studentCount,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.projectCount - a.projectCount);
}
// ─────────────────────────────────────────────────────────────────
// DEPARTMENT COMPARISON WITH INTAKE
// ─────────────────────────────────────────────────────────────────
export async function getDepartmentComparisonWithIntake() {
  await requirePrincipal();

  const { getCurrentAcademicYear } = await import('@/lib/academic-year');
  const year = getCurrentAcademicYear();

  const configs = await prisma.departmentConfiguration.findMany({
    where: { isActive: true, academicYear: year },
    select: { department: true, studentCount: true, totalIntake: true },
  });

  const departments = configs.map((c) => c.department);
  if (!departments.length) return [];

  const [projectStats, taskStats, guideStats] = await Promise.all([
    prisma.project.findMany({
      where: { department: { in: departments } },
      select: { department: true, status: true },
    }),
    prisma.task.findMany({
      where: { project: { department: { in: departments } } },
      select: { status: true, project: { select: { department: true } } },
    }),
    prisma.departmentGuide.groupBy({ by: ['department'], _count: true }),
  ]);

  return configs.map((c) => {
    const dp          = projectStats.filter((p) => p.department === c.department);
    const dt          = taskStats.filter((t) => t.project.department === c.department);
    const projectCount   = dp.length;
    const activeCount    = dp.filter((p) => p.status === 'ACTIVE').length;
    const completedCount = dp.filter((p) => p.status === 'COMPLETED').length;
    const totalTasks     = dt.length;
    const doneTasks      = dt.filter((t) => t.status === 'DONE').length;
    const guideCount     = guideStats.find((g) => g.department === c.department)?._count ?? 0;

    return {
      department:          c.department,
      projectCount,
      guideCount,
      studentCount:        c.studentCount,
      totalIntake:         c.totalIntake ?? 0,
      activeCount,
      completedCount,
      totalTasks,
      doneTasks,
      completionRate:     projectCount > 0 ? Math.round((completedCount / projectCount) * 100) : 0,
      taskCompletionRate: totalTasks   > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// PRINCIPAL DEPARTMENT DRILL-DOWN
// ─────────────────────────────────────────────────────────────────
export type DeptDrilldownData = {
  department:       string;
  guideCount:       number;
  studentCount:     number;
  divisionCount:    number;
  totalIntake:      number;
  totalProjects:    number;
  activeProjects:   number;
  completedProjects:number;
  totalTasks:       number;
  completedTasks:   number;
  totalReviews:     number;
  statusBreakdown:  { name: string; value: number }[];
  domainBreakdown:  { name: string; value: number }[];
  guideLoad:        { name: string; projects: number }[];
  projectTrend:     { month: string; count: number }[];
  recentProjects: {
    id:          string;
    title:       string;
    domain:      string;
    status:      string;
    memberCount: number;
  }[];
};

export async function getDepartmentDrilldown(department: string): Promise<DeptDrilldownData> {
  await requirePrincipal();
  if (!department) throw new Error('Department is required.');

  const { getCurrentAcademicYear } = await import('@/lib/academic-year');
  const year = getCurrentAcademicYear();

  const guideUsers = await prisma.departmentGuide.findMany({
    where: { department },
    select: { userId: true },
  });
  const guideIds    = guideUsers.map((g) => g.userId);
  const guideFilter = guideIds.length
    ? { teacherId: { in: guideIds } }
    : { id: '__none__' };

  const [
    config, guideCount, statusCounts, domainCounts,
    guidesWithLoad, totalTasks, completedTasks,
    totalReviews, recentProjects, projectDates,
  ] = await Promise.all([
    prisma.departmentConfiguration.findFirst({
      where: { department, academicYear: year, isActive: true },
    }),
    prisma.departmentGuide.count({ where: { department } }),
    prisma.project.groupBy({ by: ['status'], where: guideFilter, _count: true }),
    prisma.project.groupBy({
      by: ['domain'], where: guideFilter, _count: true,
      orderBy: { _count: { domain: 'desc' } }, take: 10,
    }),
    prisma.departmentGuide.findMany({
      where: { department },
      include: {
        user: { select: { name: true, _count: { select: { managedProjects: true } } } },
      },
    }),
    prisma.task.count({ where: { project: guideFilter } }),
    prisma.task.count({ where: { project: guideFilter, status: 'DONE' } }),
    prisma.review.count({ where: { project: guideFilter } }),
    prisma.project.findMany({
      where: guideFilter,
      include: { _count: { select: { members: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.project.findMany({
      where: { ...guideFilter, createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true },
    }),
  ]);

  const monthMap = new Map<string, number>();
  for (const p of projectDates) {
    const key = p.createdAt.getFullYear() + '-' + String(p.createdAt.getMonth() + 1).padStart(2, '0');
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }
  const projectTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const totalProjects    = statusCounts.reduce((s, d) => s + d._count, 0);
  const activeProjects   = statusCounts.find((s) => s.status === 'ACTIVE')?._count    ?? 0;
  const completedProjects= statusCounts.find((s) => s.status === 'COMPLETED')?._count ?? 0;

  return {
    department,
    guideCount,
    studentCount:      config?.studentCount  ?? 0,
    divisionCount:     config?.divisionCount ?? 0,
    totalIntake:       config?.totalIntake   ?? 0,
    totalProjects,
    activeProjects,
    completedProjects,
    totalTasks,
    completedTasks,
    totalReviews,
    statusBreakdown: statusCounts.map((s) => ({ name: s.status, value: s._count })),
    domainBreakdown: domainCounts.filter((d) => d.domain).map((d) => ({ name: d.domain!, value: d._count })),
    guideLoad:       guidesWithLoad.map((g) => ({ name: g.user.name, projects: g.user._count.managedProjects })),
    projectTrend,
    recentProjects:  recentProjects.map((p) => ({
      id: p.id, title: p.title, domain: p.domain, status: p.status, memberCount: p._count.members,
    })),
  };
}
