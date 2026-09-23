import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { 
  PublicationType, 
  IndexingType, 
  ProjectCategory, 
  ShowcaseProjectDomain, 
  SDG 
} from "@prisma/client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// 1. ADDED PAGINATION TO SCHEMA
const PublicationFilterSchema = z.object({
  projectId: z.string().optional(),
  department: z.string().optional(),
  category: z.nativeEnum(ProjectCategory).optional(),
  domain: z.nativeEnum(ShowcaseProjectDomain).optional(),
  sdg: z.nativeEnum(SDG).optional(),
  publicationType: z.nativeEnum(PublicationType).optional(),
  indexingType: z.nativeEnum(IndexingType).optional(),
  isFunded: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  year: z.string().regex(/^\d{4}$/, "Must be a valid 4-digit year").optional(),
  
  // Pagination params with defaults
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.TGS_PORTAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const { searchParams } = new URL(req.url);
    const queryData = Object.fromEntries(searchParams.entries());
    
    const parsed = PublicationFilterSchema.safeParse(queryData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filters", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const filters = parsed.data;

    const whereClause: any = { status: "APPROVED" };

    if (filters.projectId) whereClause.projectId = filters.projectId;
    if (filters.publicationType) whereClause.publicationType = filters.publicationType;
    if (filters.indexingType) whereClause.indexingType = filters.indexingType;
    if (filters.isFunded !== undefined) whereClause.isFunded = filters.isFunded;
    
    if (filters.year) {
      const startDate = new Date(`${filters.year}-01-01T00:00:00Z`);
      const endDate = new Date(`${filters.year}-12-31T23:59:59Z`);
      whereClause.publicationDate = { gte: startDate, lte: endDate };
    }

    if (filters.department || filters.category || filters.domain || filters.sdg) {
      whereClause.project = {};
      if (filters.department) whereClause.project.department = filters.department;
      if (filters.category) whereClause.project.category = filters.category;
      if (filters.domain) whereClause.project.domain = filters.domain;
      if (filters.sdg) whereClause.project.sdg = filters.sdg;
    }

    // 2. PRISMA TRANSACTION FOR PAGINATION
    // Fetch total count and paginated items concurrently
    const [totalCount, publications] = await prisma.$transaction([
      prisma.publication.count({ where: whereClause }),
      prisma.publication.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          authors: true,
          publicationType: true,
          subType: true,
          indexingType: true,
          uniqueIdentifier: true,
          publicationDate: true,
          score: true,
          isFunded: true,
          project: {
            select: {
              id: true,
              title: true,
              department: true,
              category: true,
              domain: true,
            }
          }
        },
        orderBy: { publicationDate: "desc" },
        // Pagination logic
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      })
    ]);

    // 3. UPDATED RESPONSE PAYLOAD
    return NextResponse.json({
      pagination: {
        total: totalCount,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(totalCount / filters.limit),
      },
      filtersApplied: filters,
      publications
    }, { status: 200, headers: CORS_HEADERS });

  } catch (error) {
    console.error("[PUBLICATIONS_API_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: CORS_HEADERS });
  }
}