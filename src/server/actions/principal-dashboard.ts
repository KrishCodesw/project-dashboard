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
      deptProjectCounts,
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
      prisma.project.groupBy({ by: ["department", "status"], _count: true }),
      prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as count
        FROM projects
        WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month ASC
      `,
    ]);

    const totalProjects = deptProjectCounts.reduce((s, d) => s + d._count, 0);
    const activeProjects = deptProjectCounts.filter((d) => d.status === "ACTIVE").reduce((s, d) => s + d._count, 0);
    const completedProjects = deptProjectCounts.filter((d) => d.status === "COMPLETED").reduce((s, d) => s + d._count, 0);

    const projectTrend = projectDates.map((m) => ({ month: m.month, count: Number(m.count) }));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentProjects, recentReviews] = await Promise.all([
      prisma.project.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    // ──────────────────────────────────────────────
    // 2. Task & Milestone Analytics
    // ──────────────────────────────────────────────
    const [taskStatusBreakdown, taskCompletionByDept, totalMilestones, completedMilestones] =
      await Promise.all([
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.task.groupBy({
          by: ["status"],
          where: { project: { department: { not: null } } },
          _count: true,
        }),
        prisma.milestone.count(),
        prisma.milestone.count({ where: { isCompleted: true } }),
      ]);

    const totalTasks = taskStatusBreakdown.reduce((s, t) => s + t._count, 0);
    const completedTasks = taskStatusBreakdown.find((t) => t.status === "DONE")?._count ?? 0;
    const inProgressTasks = taskStatusBreakdown.find((t) => t.status === "IN_PROGRESS")?._count ?? 0;

    // ──────────────────────────────────────────────
    // 3. Review & Feedback Analytics
    // ──────────────────────────────────────────────
    const [reviewCount, completedReviewCount] = await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { status: "COMPLETED" } }),
    ]);

    // ──────────────────────────────────────────────
    // 4. User & Guide Analytics
    // ──────────────────────────────────────────────
    const [userCounts, guideGroup, guideUsers, projectCountsByTeacher] = await Promise.all([
      prisma.user.groupBy({
        by: ["role"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.departmentGuide.groupBy({ by: ["department"], _count: true }),
      prisma.user.findMany({
        where: { isActive: true, role: "TEACHER", department: { not: null } },
        select: { id: true, name: true, department: true },
        orderBy: { name: "asc" },
      }),
      prisma.project.groupBy({ by: ["teacherId"], _count: true }),
    ]);

    const totalStudents = userCounts.find((u) => u.role === "STUDENT")?._count ?? 0;
    const totalTeachers = userCounts.find((u) => u.role === "TEACHER")?._count ?? 0;
    const totalGuideCount = guideGroup.reduce((s, g) => s + g._count, 0);
    const countMap = new Map(projectCountsByTeacher.map((p) => [p.teacherId, p._count]));
    const guideLoad = guideUsers.map((g) => ({
      name: g.name,
      projects: countMap.get(g.id) ?? 0,
    }));

    // Student participation: members per project
    const memberCounts = await prisma.projectMember.groupBy({ by: ["projectId"], _count: true });
    const memberDistribution = [0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4+
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
    // 6. Department Analytics
    // ──────────────────────────────────────────────
    const [deptConfigs, deptUserCounts] = await Promise.all([
      prisma.departmentConfiguration.findMany({ where: { isActive: true } }),
      prisma.user.groupBy({
        by: ["department", "role"],
        where: { isActive: true, department: { not: null } },
        _count: true,
      }),
    ]);

    const activeDepts = deptConfigs.length;

    // Build per-department map
    const deptMap = new Map<string, {
      projectCount: number; activeCount: number; completedCount: number;
      guideCount: number; studentCount: number; teacherCount: number;
      totalTasks: number; doneTasks: number;
    }>();
    for (const config of deptConfigs) {
      deptMap.set(config.department, {
        projectCount: 0, activeCount: 0, completedCount: 0,
        guideCount: 0, studentCount: 0, teacherCount: 0,
        totalTasks: 0, doneTasks: 0,
      });
    }

    for (const d of deptProjectCounts) {
      if (!d.department) continue;
      const s = deptMap.get(d.department);
      if (!s) continue;
      s.projectCount += d._count;
      if (d.status === "ACTIVE") s.activeCount += d._count;
      if (d.status === "COMPLETED") s.completedCount += d._count;
    }

    for (const g of guideGroup) {
      if (!g.department) continue;
      const s = deptMap.get(g.department);
      if (s) s.guideCount = g._count;
    }

    for (const u of deptUserCounts) {
      if (!u.department) continue;
      const s = deptMap.get(u.department);
      if (!s) continue;
      if (u.role === "STUDENT") s.studentCount += u._count;
      if (u.role === "TEACHER") s.teacherCount += u._count;
    }

    // Task completion by dept via raw SQL (groupBy across relation not supported)
    const tasksByDept = await prisma.$queryRaw<Array<{ department: string; done: bigint; total: bigint }>>`
      SELECT p.department, SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) as done, COUNT(*) as total
      FROM tasks t
      JOIN projects p ON p.id = t.projectId
      WHERE p.department IS NOT NULL
      GROUP BY p.department
    `;
    for (const row of tasksByDept) {
      const s = deptMap.get(row.department);
      if (s) {
        s.totalTasks = Number(row.total);
        s.doneTasks = Number(row.done);
      }
    }

    const departmentComparison = Array.from(deptMap.entries())
      .map(([department, s]) => ({
        department,
        projectCount: s.projectCount,
        guideCount: s.guideCount,
        studentCount: s.studentCount,
        teacherCount: s.teacherCount,
        activeCount: s.activeCount,
        completedCount: s.completedCount,
        totalTasks: s.totalTasks,
        doneTasks: s.doneTasks,
        completionRate: s.projectCount > 0 ? Math.round((s.completedCount / s.projectCount) * 100) : 0,
        taskCompletionRate: s.totalTasks > 0 ? Math.round((s.doneTasks / s.totalTasks) * 100) : 0,
      }))
      .sort((a, b) => b.projectCount - a.projectCount);

    // ──────────────────────────────────────────────
    // 7. Return aggregated data
    // ──────────────────────────────────────────────
    return {
      // KPIs
      totalProjects,
      totalGuideCount,
      totalStudents,
      totalTeachers,
      activeDepts,
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
      // Charts: Project
      statusBreakdown: statusBreakdown.map((s) => ({ name: s.status, value: s._count })),
      domainBreakdown: domainBreakdown.filter((d) => d.domain).map((d) => ({ name: d.domain!, value: d._count })),
      typeBreakdown: typeBreakdown.filter((t) => t.type).map((t) => ({ name: t.type!, value: t._count })),
      categoryBreakdown: categoryBreakdown.filter((c) => c.category).map((c) => ({ name: c.category!, value: c._count })),
      sdgBreakdown: sdgBreakdown.filter((s) => s.sdg).map((s) => ({ name: s.sdg!, value: s._count })),
      rblBreakdown: rblBreakdown.map((r) => ({ name: r.isRblProject ? "RBL" : "Non-RBL", value: r._count })),
      // Charts: Trend
      projectTrend,
      // Charts: User
      guideLoad,
      memberDistribution: memberDistribution.map((count, i) => ({
        name: i === 4 ? "4+" : String(i),
        value: count,
      })),
      // Table
      departmentComparison,
    };
  });
}
