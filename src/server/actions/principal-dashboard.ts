"use server";

import { prisma } from "@/lib/prisma";
import { requirePrincipal } from "@/lib/coe-guard";
import { cached } from "@/lib/cache";

const CACHE_TTL_MS = 45_000; // 45 seconds

export async function getPrincipalDashboardData() {
  await requirePrincipal();

  return cached("principal-dashboard", CACHE_TTL_MS, async () => {
    // ──────────────────────────────────────────────
    // 1. Project Analytics
    // ──────────────────────────────────────────────
    const [statusBreakdown, domainBreakdown, deptProjectCounts, projectDates] =
      await Promise.all([
        prisma.project.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.project.groupBy({
          by: ["domain"],
          _count: true,
          orderBy: { _count: { domain: "desc" } },
          take: 10,
        }),
        prisma.project.groupBy({
          by: ["department", "status"],
          _count: true,
        }),
        // Monthly trend — aggregated in DB, no project records loaded
        prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
          SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as count
          FROM projects
          WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
          GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
          ORDER BY month ASC
        `,
      ]);

    const totalProjects = deptProjectCounts.reduce(
      (sum, d) => sum + d._count,
      0,
    );
    const activeProjects = deptProjectCounts
      .filter((d) => d.status === "ACTIVE")
      .reduce((sum, d) => sum + d._count, 0);
    const completedProjects = deptProjectCounts
      .filter((d) => d.status === "COMPLETED")
      .reduce((sum, d) => sum + d._count, 0);

    // Monthly trend from raw SQL aggregation
    const projectTrend = projectDates.map((m) => ({
      month: m.month,
      count: Number(m.count),
    }));

    // ──────────────────────────────────────────────
    // 2. User Analytics
    // ──────────────────────────────────────────────
    const [userCounts, guideGroup] = await Promise.all([
      prisma.user.groupBy({
        by: ["role"],
        where: { isActive: true },
        _count: true,
      }),
      prisma.departmentGuide.groupBy({
        by: ["department"],
        _count: true,
      }),
    ]);

    const totalStudents =
      userCounts.find((u) => u.role === "STUDENT")?._count ?? 0;
    const totalTeachers =
      userCounts.find((u) => u.role === "TEACHER")?._count ?? 0;
    const totalGuideCount = guideGroup.reduce((sum, g) => sum + g._count, 0);

    // Guide workload
    // ponytail: O(n) sort instead of DB sort — guide list is small (<500)
    const guideUsers = await prisma.user.findMany({
      where: { isActive: true, role: "TEACHER", department: { not: null } },
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" },
    });
    const projectCounts = await prisma.project.groupBy({
      by: ["teacherId"],
      _count: true,
    });
    const countMap = new Map(projectCounts.map((p) => [p.teacherId, p._count]));
    const guideLoad = guideUsers.map((g) => ({
      name: g.name,
      projects: countMap.get(g.id) ?? 0,
    }));

    // ──────────────────────────────────────────────
    // 3. Department Analytics
    // ──────────────────────────────────────────────
    const [deptConfigs, deptUserCounts] = await Promise.all([
      prisma.departmentConfiguration.findMany({
        where: { isActive: true },
      }),
      prisma.user.groupBy({
        by: ["department", "role"],
        where: { isActive: true, department: { not: null } },
        _count: true,
      }),
    ]);

    const activeDepts = deptConfigs.length;

    // Build per-department map
    const deptMap = new Map<
      string,
      {
        projectCount: number;
        activeCount: number;
        completedCount: number;
        guideCount: number;
        studentCount: number;
        teacherCount: number;
      }
    >();
    for (const config of deptConfigs) {
      deptMap.set(config.department, {
        projectCount: 0,
        activeCount: 0,
        completedCount: 0,
        guideCount: 0,
        studentCount: 0,
        teacherCount: 0,
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

    const departmentComparison = Array.from(deptMap.entries())
      .map(([department, s]) => ({
        department,
        projectCount: s.projectCount,
        guideCount: s.guideCount,
        studentCount: s.studentCount,
        teacherCount: s.teacherCount,
        activeCount: s.activeCount,
        completedCount: s.completedCount,
        completionRate:
          s.projectCount > 0
            ? Math.round((s.completedCount / s.projectCount) * 100)
            : 0,
      }))
      .sort((a, b) => b.projectCount - a.projectCount);

    return {
      // Overview KPIs
      totalProjects,
      totalGuideCount,
      totalStudents,
      totalTeachers,
      activeDepts,
      activeProjects,
      completedProjects,
      // Charts
      statusBreakdown: statusBreakdown.map((s) => ({
        name: s.status,
        value: s._count,
      })),
      domainBreakdown: domainBreakdown
        .filter((d) => d.domain)
        .map((d) => ({ name: d.domain!, value: d._count })),
      guideLoad,
      projectTrend,
      // Table
      departmentComparison,
    };
  });
}
