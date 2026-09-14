import { workbookReader } from "./reader/workbookReader";
import { spectoraParser } from "./parser/spectoraParser";
import { spectoraNormalizer } from "./normalizer/spectoraNormalizer";
import { templateValidator } from "./validator/templateValidator";
import { ImporterResult } from "./types";

export * from "./types";
export * from "./reader/workbookReader";
export * from "./parser/spectoraParser";
export * from "./normalizer/spectoraNormalizer";
export * from "./validator/templateValidator";

export interface ImportOptions {
  filename?: string;
  templateName?: string;
}

/**
 * Deterministic Spectora Template Importer Service
 *
 * Pipeline:
 * Buffer/String -> WorkbookReader -> SpectoraParser -> SpectoraNormalizer -> TemplateValidator
 *
 * Fully decoupled from React/UI state and persistence layers.
 */
export class SpectoraImporterService {
  /**
   * Imports a Spectora spreadsheet export (XLS/XLSX or HTML table) deterministically
   */
  importWorkbook(
    input: Buffer | string,
    options: ImportOptions = {}
  ): ImporterResult {
    // 1. Low-level Workbook Reading
    const sheet = workbookReader.read(input);

    // 2. Deterministic Row Parsing & Column Detection
    const { parsedRows, globalWarnings } = spectoraParser.parseSheet(sheet);

    // 3. Hierarchical Normalization (Template -> Section -> Item -> Comment)
    const { template, warnings } = spectoraNormalizer.normalize(
      parsedRows,
      globalWarnings,
      {
        templateName: options.templateName,
        sourceFilename: options.filename,
      }
    );

    // 4. Structural Validation
    const validation = templateValidator.validate(template);

    return {
      success: validation.isValid,
      template,
      warnings,
      metrics: {
        totalRowsProcessed: sheet.rows.length,
        sectionsCreated: validation.stats.sectionCount,
        itemsCreated: validation.stats.itemCount,
        commentsCreated: validation.stats.commentCount,
        warningsCount: warnings.length,
      },
      errors: validation.errors,
    };
  }
}

export const spectoraImporter = new SpectoraImporterService();
