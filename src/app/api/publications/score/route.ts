import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PublicationType } from "@prisma/client";

// 1. CORS Configuration
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // Or specify the TGS portal URL
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// 2. Input Validation Schema
const ScoreQuerySchema = z.object({
  publicationType: z.nativeEnum(PublicationType, {
    errorMap: () => ({ message: "Invalid publication type. Must be PAPER, PATENT, BOOK_CHAPTER, COPYRIGHT, or REVIEW." }),
  }),
  // Default to empty string if missing, matching your DB seeds
  subType: z.string().trim().optional().default(""), 
});

export async function GET(req: NextRequest) {
  try {
    // 3. API Key Authentication
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.TGS_PORTAL_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized. Missing or invalid API key." }, 
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 4. Extract and Validate Query Params
    const { searchParams } = new URL(req.url);
    const queryData = {
      publicationType: searchParams.get("publicationType"),
      subType: searchParams.get("subType") || "", // Map nulls to empty strings
    };

    const parsed = ScoreQuerySchema.safeParse(queryData);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { publicationType, subType } = parsed.data;

    // 5. Database Fetch
    const config = await prisma.publicationScoreConfig.findUnique({
      where: {
        publicationType_subType: {
          publicationType,
          subType,
        },
      },
    });

    // 6. Handle Missing Configs vs Found Configs
    if (!config) {
      return NextResponse.json({
        score: 0,
        found: false,
        message: `No scoring rule found for ${publicationType} with subType '${subType}'`,
      }, { status: 200, headers: CORS_HEADERS });
    }

    return NextResponse.json({
      score: config.score,
      found: true,
      publicationType,
      subType
    }, { status: 200, headers: CORS_HEADERS });

  } catch (error) {
    console.error("[TGS_SCORE_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}