import { NextRequest, NextResponse } from "next/server";
import { templateRepository } from "@/db/repositories";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = await templateRepository.getTemplateById(params.id, true);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (err: any) {
    console.error(`[GET /api/templates/${params.id}] Error:`, err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch template." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Check if template exists first
    const existing = await templateRepository.getTemplateById(params.id, false);
    if (!existing) {
      return NextResponse.json(
        { error: `Template with ID '${params.id}' not found.` },
        { status: 404 }
      );
    }

    // 2. Perform deletion
    const success = await templateRepository.deleteTemplate(params.id);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete template from database." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: params.id });
  } catch (err: any) {
    console.error(`[DELETE /api/templates/${params.id}] Error:`, err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete template." },
      { status: 500 }
    );
  }
}

