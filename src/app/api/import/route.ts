import { NextRequest, NextResponse } from "next/server";
import { templateImportService } from "@/services/templateImportService";

export const maxDuration = 60; // Allow sufficient serverless duration for large spreadsheets

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit
const ALLOWED_EXTENSIONS = [".xls", ".xlsx", ".html", ".htm", ".txt", ".csv"];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let buffer: Buffer;
    let filename = "uploaded_template.xls";
    let templateName: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const customName = formData.get("templateName") as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided in form data." },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File exceeds maximum allowed size of 15MB (uploaded size: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          },
          { status: 400 }
        );
      }

      filename = file.name;
      const ext = "." + filename.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported file extension '${ext}'. Please upload a Spectora export (.xls, .xlsx, .html, .htm).`,
          },
          { status: 400 }
        );
      }

      if (customName && customName.trim().length > 0) {
        templateName = customName.trim();
      }

      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      const rawText = body.content || body.html;
      if (!rawText || typeof rawText !== "string") {
        return NextResponse.json(
          { success: false, error: "No HTML or text content provided." },
          { status: 400 }
        );
      }

      buffer = Buffer.from(rawText, "utf-8");
      filename = body.filename || "pasted_template.html";
      templateName = body.templateName;
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported request Content-Type. Expected multipart/form-data or application/json." },
        { status: 400 }
      );
    }

    // Call the deterministic import service
    const summary = await templateImportService.processImport({
      buffer,
      filename,
      templateName,
    });

    return NextResponse.json(summary, { status: summary.success ? 200 : 422 });
  } catch (err: any) {
    console.error("[POST /api/import] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        errors: [err?.message || "Internal server error during import processing."],
      },
      { status: 500 }
    );
  }
}
