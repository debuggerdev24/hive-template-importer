import { getSupabaseClient } from "../client";
import { ImportRun, ImportStatus, ImportWarning, WarningSeverity, ImportWarningType } from "@/types/importer";
import { DbImportRun, DbImportWarning } from "@/types/database";

export interface CreateImportRunInput {
  templateId?: string | null;
  filename: string;
  fileSizeBytes?: number;
  fileFormat?: string;
  totalRowsDetected?: number;
}

export interface UpdateImportRunInput {
  status?: ImportStatus;
  templateId?: string | null;
  totalRowsDetected?: number;
  totalSectionsImported?: number;
  totalItemsImported?: number;
  totalCommentsImported?: number;
  warningCount?: number;
  errorMessage?: string | null;
  completedAt?: string | null;
}

export interface AddImportWarningInput {
  importRunId: string;
  warningType: ImportWarningType | string;
  severity?: WarningSeverity;
  message: string;
  rawSnippet?: string | null;
  rowNumber?: number | null;
  columnName?: string | null;
}

export class ImportRepository {
  async createImportRun(input: CreateImportRunInput): Promise<ImportRun | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("import_runs")
      .insert({
        template_id: input.templateId ?? null,
        status: "pending",
        filename: input.filename,
        file_size_bytes: input.fileSizeBytes ?? null,
        file_format: input.fileFormat ?? null,
        total_rows_detected: input.totalRowsDetected ?? 0,
        total_sections_imported: 0,
        total_items_imported: 0,
        total_comments_imported: 0,
        warning_count: 0,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[ImportRepository.createImportRun] Error:", error);
      return null;
    }

    return this.mapDbRunToDomain(data as DbImportRun);
  }

  async updateImportRun(id: string, input: UpdateImportRunInput): Promise<ImportRun | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const payload: Record<string, unknown> = {};
    if (input.status !== undefined) payload.status = input.status;
    if (input.templateId !== undefined) payload.template_id = input.templateId;
    if (input.totalRowsDetected !== undefined) payload.total_rows_detected = input.totalRowsDetected;
    if (input.totalSectionsImported !== undefined) payload.total_sections_imported = input.totalSectionsImported;
    if (input.totalItemsImported !== undefined) payload.total_items_imported = input.totalItemsImported;
    if (input.totalCommentsImported !== undefined) payload.total_comments_imported = input.totalCommentsImported;
    if (input.warningCount !== undefined) payload.warning_count = input.warningCount;
    if (input.errorMessage !== undefined) payload.error_message = input.errorMessage;
    if (input.completedAt !== undefined) payload.completed_at = input.completedAt;

    const { data, error } = await supabase
      .from("import_runs")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[ImportRepository.updateImportRun] Error:", error);
      return null;
    }

    return this.mapDbRunToDomain(data as DbImportRun);
  }

  async getImportRunById(id: string): Promise<ImportRun | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data: run, error: runError } = await supabase
      .from("import_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (runError || !run) return null;

    const { data: warnings } = await supabase
      .from("import_warnings")
      .select("*")
      .eq("import_run_id", id)
      .order("created_at", { ascending: true });

    const domainRun = this.mapDbRunToDomain(run as DbImportRun);
    domainRun.warnings = (warnings || []).map((w: DbImportWarning) => this.mapDbWarningToDomain(w));
    return domainRun;
  }

  async addImportWarnings(warnings: AddImportWarningInput[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase || warnings.length === 0) return false;

    const payload = warnings.map((w) => ({
      import_run_id: w.importRunId,
      warning_type: w.warningType,
      severity: w.severity ?? "warning",
      message: w.message,
      raw_snippet: w.rawSnippet ?? null,
      row_number: w.rowNumber ?? null,
      column_name: w.columnName ?? null,
    }));

    const { error } = await supabase.from("import_warnings").insert(payload);
    if (error) {
      console.error("[ImportRepository.addImportWarnings] Error:", error);
      return false;
    }

    return true;
  }

  async getImportWarnings(importRunId: string): Promise<ImportWarning[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("import_warnings")
      .select("*")
      .eq("import_run_id", importRunId)
      .order("row_number", { ascending: true, nullsFirst: false });

    if (error || !data) return [];
    return data.map((d: DbImportWarning) => this.mapDbWarningToDomain(d));
  }

  private mapDbRunToDomain(d: DbImportRun): ImportRun {
    return {
      id: d.id,
      templateId: d.template_id,
      status: d.status as ImportStatus,
      filename: d.filename,
      fileSizeBytes: d.file_size_bytes,
      fileFormat: d.file_format,
      totalRowsDetected: d.total_rows_detected,
      totalSectionsImported: d.total_sections_imported,
      totalItemsImported: d.total_items_imported,
      totalCommentsImported: d.total_comments_imported,
      warningCount: d.warning_count,
      errorMessage: d.error_message,
      startedAt: d.started_at,
      completedAt: d.completed_at,
    };
  }

  private mapDbWarningToDomain(d: DbImportWarning): ImportWarning {
    return {
      id: d.id,
      importRunId: d.import_run_id,
      warningType: d.warning_type,
      severity: d.severity as WarningSeverity,
      message: d.message,
      rawSnippet: d.raw_snippet,
      rowNumber: d.row_number,
      columnName: d.column_name,
      createdAt: d.created_at,
    };
  }
}

export const importRepository = new ImportRepository();
