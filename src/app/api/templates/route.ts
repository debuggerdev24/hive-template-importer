import { NextResponse } from "next/server";
import { templateRepository } from "@/db/repositories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const templates = await templateRepository.listTemplates();
    return NextResponse.json(templates, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/templates] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to list templates." },
      { status: 500 }
    );
  }
}
