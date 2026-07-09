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
