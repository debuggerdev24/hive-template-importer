import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/db/repositories";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let customName: string | undefined;
    try {
      const body = await req.json();
      if (body?.name) customName = body.name;
    } catch {
      // Body is optional
    }

    const duplicated = await templateRepository.duplicateTemplate(
      params.id,
      customName
    );

    if (!duplicated) {
      return NextResponse.json(
        { error: "Failed to duplicate template." },
        { status: 400 }
      );
    }

    return NextResponse.json(duplicated);
  } catch (err: any) {
    console.error(`[POST /api/templates/${params.id}/duplicate] Error:`, err);
    return NextResponse.json(
      { error: err?.message || "Failed to duplicate template." },
      { status: 500 }
    );
  }
}
