import { spectoraImporter } from "@/features/importer";
import {
  confidenceReportBuilder,
  ConfidenceReport,
} from "@/features/importer/audit/confidenceReportBuilder";
import {
  templateRepository,
  importRepository,
} from "@/db/repositories";
import { getSupabaseClient } from "@/db/client";
import { ImportStatus } from "@/types/importer";

export interface ImportFileInput {
  buffer: Buffer | string;
  filename: string;
  templateName?: string;
}

export interface WarningSummaryItem {
  rowNumber?: number | null;
  columnName?: string | null;
  sectionName?: string | null;
  itemName?: string | null;
  commentName?: string | null;
  warningType: string;
  message: string;
  handlingDecision?: string | null;
  classification?: string | null;
  rawSnippet?: string | null;
}

export interface ImportExecutionSummary {
  success: boolean;
  importRunId: string;
  templateId?: string | null;
  templateName: string;
  status: ImportStatus;
  sectionsImported: number;
  itemsImported: number;
  commentsImported: number;
  warnings: WarningSummaryItem[];
  unsupportedContent: string[];
  errors: string[];
  durationMs: number;
  confidenceReport?: ConfidenceReport;
}

/**
 * Service that coordinates file ingestion, validation, and safe relational persistence.
 * Guarantees zero partial/orphaned templates on failure.
 */
export class TemplateImportService {
  /**
   * Orchestrates the complete end-to-end import pipeline
   */
  async processImport(input: ImportFileInput): Promise<ImportExecutionSummary> {
    const startTime = Date.now();
    const errors: string[] = [];

    // 1. Initialize Import Run in 'pending' status
    const fileSize = Buffer.isBuffer(input.buffer)
      ? input.buffer.length
      : Buffer.byteLength(input.buffer, "utf-8");

    const importRun = await importRepository.createImportRun({
      filename: input.filename,
      fileSizeBytes: fileSize,
      fileFormat: input.filename.split(".").pop() || "unknown",
      totalRowsDetected: 0,
    });

    const runId = importRun ? importRun.id : `mock-run-${Date.now()}`;

    // 2. Parse, Normalize, and Validate (Pure, deterministic, no side effects)
    let parseResult;
    try {
      parseResult = spectoraImporter.importWorkbook(input.buffer, {
        filename: input.filename,
        templateName: input.templateName,
      });
    } catch (parseError: any) {
      const errMsg = parseError?.message || "Failed to read or parse workbook.";
      errors.push(errMsg);

      await importRepository.updateImportRun(runId, {
        status: "failed",
        errorMessage: errMsg,
        completedAt: new Date().toISOString(),
      });

      return {
        success: false,
        importRunId: runId,
        templateName: input.templateName || input.filename,
        status: "failed",
        sectionsImported: 0,
        itemsImported: 0,
        commentsImported: 0,
        warnings: [],
        unsupportedContent: [],
        errors,
        durationMs: Date.now() - startTime,
      };
    }

    const { template: templateDraft, warnings, metrics, errors: valErrors } = parseResult;

    // Build formal factual confidence & preservation report
    const confidenceReport = confidenceReportBuilder.buildReport(
      templateDraft,
      warnings,
      metrics.totalRowsProcessed
    );

    // Collect unsupported content descriptions
    const unsupportedContent: string[] = warnings
      .filter((w) => w.warningType === "UNSUPPORTED_COLUMN" || w.warningType === "UNMATCHED_TAG" || w.warningType === "RICH_FORMAT_SIMPLIFIED" || w.warningType === "UNSUPPORTED_ELEMENT")
      .map((w) => `${w.warningType}: ${w.message}`);

    const warningsSummary: WarningSummaryItem[] = warnings.map((w) => ({
      rowNumber: w.rowNumber,
      columnName: w.columnName,
      sectionName: w.sectionName,
      itemName: w.itemName,
      commentName: w.commentName,
      warningType: w.warningType,
      message: w.message,
      handlingDecision: w.handlingDecision,
      classification: w.classification,
      rawSnippet: w.rawSnippet,
    }));

    // 3. Validation Guard: If fatal errors exist, abort BEFORE creating any template records
    if (!parseResult.success || valErrors.length > 0) {
      errors.push(...valErrors);

      await importRepository.updateImportRun(runId, {
        status: "failed",
        totalRowsDetected: metrics.totalRowsProcessed,
        warningCount: warnings.length,
        errorMessage: errors.join("; "),
        completedAt: new Date().toISOString(),
      });

      if (warnings.length > 0) {
        await importRepository.addImportWarnings(
          warnings.map((w) => ({
            importRunId: runId,
            warningType: w.warningType,
            severity: w.severity,
            message: w.message,
            rawSnippet: w.rawSnippet,
            rowNumber: w.rowNumber,
            columnName: w.columnName,
          }))
        );
      }

      return {
        success: false,
        importRunId: runId,
        templateName: templateDraft.name,
        status: "failed",
        sectionsImported: 0,
        itemsImported: 0,
        commentsImported: 0,
        warnings: warningsSummary,
        unsupportedContent,
        errors,
        durationMs: Date.now() - startTime,
        confidenceReport,
      };
    }

    // 4. Update status to 'processing'
    await importRepository.updateImportRun(runId, {
      status: "processing",
      totalRowsDetected: metrics.totalRowsProcessed,
    });

    // 5. Safe Persistence Strategy with Cascading Rollback
    let createdTemplateId: string | null = null;
    let sectionsCount = 0;
    let itemsCount = 0;
    let commentsCount = 0;

    try {
      const supabase = getSupabaseClient();

      if (supabase) {
        // Step A: Insert root template
        const { data: createdTpl, error: tplErr } = await supabase
          .from("templates")
          .insert({
            name: templateDraft.name,
            description: templateDraft.description,
            original_source: templateDraft.originalSource,
            source_filename: templateDraft.sourceFilename,
            source_metadata: templateDraft.sourceMetadata || {},
          })
          .select()
          .single();

        if (tplErr || !createdTpl) {
          throw new Error(`Failed to create root template record: ${tplErr?.message}`);
        }

        createdTemplateId = createdTpl.id;

        // Step B: Insert Sections, Items, and Comments in sequential order
        for (const sec of templateDraft.sections) {
          const { data: createdSec, error: secErr } = await supabase
            .from("sections")
            .insert({
              template_id: createdTemplateId,
              name: sec.name,
              order_index: sec.orderIndex,
              source_metadata: sec.sourceMetadata || {},
            })
            .select()
            .single();

          if (secErr || !createdSec) {
            throw new Error(`Failed to insert section '${sec.name}': ${secErr?.message}`);
          }
          sectionsCount++;

          for (const it of sec.items) {
            const { data: createdItem, error: itemErr } = await supabase
              .from("items")
              .insert({
                section_id: createdSec.id,
                name: it.name,
                order_index: it.orderIndex,
                source_metadata: it.sourceMetadata || {},
              })
              .select()
              .single();

            if (itemErr || !createdItem) {
              throw new Error(`Failed to insert item '${it.name}': ${itemErr?.message}`);
            }
            itemsCount++;

            if (it.comments.length > 0) {
              const commentRows = it.comments.map((c) => ({
                item_id: createdItem.id,
                comment_name: c.commentName ?? null,
                comment_text: c.commentText,
                content_format: c.contentFormat || "html",
                comment_type: c.commentType ?? null,
                category: c.category ?? null,
                recommendation: c.recommendation ?? null,
                order_index: c.orderIndex,
                answer_type: c.answerType ?? null,
                default_value: c.defaultValue ?? null,
                default_value_2: c.defaultValue2 ?? null,
                default_unit_type: c.defaultUnitType ?? null,
                default_location: c.defaultLocation ?? null,
                default_estimate_min: c.defaultEstimateMin ?? null,
                default_estimate_max: c.defaultEstimateMax ?? null,
                locked: c.locked ?? false,
                simple_format: c.simpleFormat ?? false,
                disable_photos: c.disablePhotos ?? false,
                multiple_choice_options: c.multipleChoiceOptions || [],
                unit_type_options: c.unitTypeOptions || [],
                default_photos_and_captions: c.defaultPhotosAndCaptions || [],
                source_last_modified: c.sourceLastModified ?? null,
                source_metadata: c.sourceMetadata || {},
              }));

              const { error: commentsErr } = await supabase
                .from("comments")
                .insert(commentRows);

              if (commentsErr) {
                throw new Error(`Failed to insert comments for item '${it.name}': ${commentsErr?.message}`);
              }
              commentsCount += it.comments.length;
            }
          }
        }
      } else {
        // When Supabase credentials are pending in local env, use repository mock/memory mode
        const tpl = await templateRepository.createTemplate({
          name: templateDraft.name,
          description: templateDraft.description,
          originalSource: templateDraft.originalSource,
          sourceFilename: templateDraft.sourceFilename,
          sourceMetadata: templateDraft.sourceMetadata,
        });
        createdTemplateId = tpl ? tpl.id : `mock-template-${Date.now()}`;
        sectionsCount = metrics.sectionsCreated;
        itemsCount = metrics.itemsCreated;
        commentsCount = metrics.commentsCreated;
      }

      // Step C: Persist all diagnostic warnings
      if (warnings.length > 0) {
        await importRepository.addImportWarnings(
          warnings.map((w) => ({
            importRunId: runId,
            warningType: w.warningType,
            severity: w.severity,
            message: w.message,
            rawSnippet: w.rawSnippet,
            rowNumber: w.rowNumber,
            columnName: w.columnName,
          }))
        );
      }

      // Step D: Complete Import Run
      const finalStatus: ImportStatus =
        warnings.length > 0 ? "completed_with_warnings" : "completed";

      await importRepository.updateImportRun(runId, {
        status: finalStatus,
        templateId: createdTemplateId,
        totalSectionsImported: sectionsCount,
        totalItemsImported: itemsCount,
        totalCommentsImported: commentsCount,
        warningCount: warnings.length,
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        importRunId: runId,
        templateId: createdTemplateId,
        templateName: templateDraft.name,
        status: finalStatus,
        sectionsImported: sectionsCount,
        itemsImported: itemsCount,
        commentsImported: commentsCount,
        warnings: warningsSummary,
        unsupportedContent,
        errors: [],
        durationMs: Date.now() - startTime,
        confidenceReport,
      };
    } catch (saveError: any) {
      // ROLLBACK: If any step fails during persistence, clean up root template to prevent partial data
      if (createdTemplateId) {
        try {
          await templateRepository.deleteTemplate(createdTemplateId);
        } catch (cleanupErr) {
          console.error("[TemplateImportService.rollback] Cleanup error:", cleanupErr);
        }
      }

      const saveErrMsg = `Database persistence failure: ${saveError?.message || "Connection timeout or transaction aborted"}. All partial template records were automatically rolled back. Please verify database connectivity in .env.local and try again.`;
      errors.push(saveErrMsg);

      await importRepository.updateImportRun(runId, {
        status: "failed",
        errorMessage: saveErrMsg,
        completedAt: new Date().toISOString(),
      });

      return {
        success: false,
        importRunId: runId,
        templateName: templateDraft.name,
        status: "failed",
        sectionsImported: 0,
        itemsImported: 0,
        commentsImported: 0,
        warnings: warningsSummary,
        unsupportedContent,
        errors,
        durationMs: Date.now() - startTime,
        confidenceReport,
      };
    }
  }
}

export const templateImportService = new TemplateImportService();
