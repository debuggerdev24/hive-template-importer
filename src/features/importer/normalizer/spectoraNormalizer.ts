import {
  ParsedSpectoraRow,
  ParsedTemplateDraft,
  ParsedSectionDraft,
  ParsedItemDraft,
  ParsedCommentDraft,
  ParsedWarningDraft,
} from "../types";

export interface NormalizerOptions {
  templateName?: string;
  sourceFilename?: string;
}

export class SpectoraNormalizer {
  /**
   * Normalizes flat parsed Spectora rows into a hierarchical template graph
   */
  normalize(
    rows: ParsedSpectoraRow[],
    globalWarnings: ParsedWarningDraft[] = [],
    options: NormalizerOptions = {}
  ): {
    template: ParsedTemplateDraft;
    warnings: ParsedWarningDraft[];
  } {
    const allWarnings: ParsedWarningDraft[] = [...globalWarnings];

    // Collect all row-level warnings
    rows.forEach((r) => {
      if (r.warnings && r.warnings.length > 0) {
        allWarnings.push(...r.warnings);
      }
    });

    // We maintain ordered arrays and lookup maps to guarantee sequence preservation
    const sections: ParsedSectionDraft[] = [];
    const sectionMap = new Map<string, ParsedSectionDraft>();
    const itemMap = new Map<string, ParsedItemDraft>(); // key: `${sectionName}:::${itemName}`

    let currentSectionIndex = 0;

    rows.forEach((row) => {
      // 1. Get or create Section preserving appearance order
      let section = sectionMap.get(row.sectionName);
      if (!section) {
        section = {
          name: row.sectionName,
          orderIndex: currentSectionIndex++,
          items: [],
          sourceMetadata: {},
        };
        sectionMap.set(row.sectionName, section);
        sections.push(section);
      }

      // 2. Get or create Item under this Section preserving appearance order
      const itemKey = `${row.sectionName}:::${row.itemName}`;
      let item = itemMap.get(itemKey);
      if (!item) {
        item = {
          name: row.itemName,
          orderIndex: section.items.length,
          comments: [],
          sourceMetadata: {},
        };
        itemMap.set(itemKey, item);
        section.items.push(item);
      }

      // 3. Create and attach Comment / Finding draft
      const commentDraft: ParsedCommentDraft = {
        commentName: row.commentName,
        commentText: row.commentText,
        contentFormat: row.contentFormat,
        commentType: row.commentType,
        category: row.category,
        multipleChoiceOptions: row.multipleChoiceOptions,
        unitTypeOptions: row.unitTypeOptions,
        recommendation: row.recommendation,
        orderIndex: row.orderIndex !== undefined ? row.orderIndex : item.comments.length,
        answerType: row.answerType,
        defaultValue: row.defaultValue,
        defaultValue2: row.defaultValue2,
        defaultUnitType: row.defaultUnitType,
        defaultLocation: row.defaultLocation,
        defaultEstimateMin: row.defaultEstimateMin,
        defaultEstimateMax: row.defaultEstimateMax,
        locked: row.locked,
        simpleFormat: row.simpleFormat,
        disablePhotos: row.disablePhotos,
        defaultPhotosAndCaptions: row.defaultPhotosAndCaptions,
        sourceLastModified: row.sourceLastModified,
        sourceMetadata: row.sourceMetadata,
      };

      item.comments.push(commentDraft);
    });

    // Derive a clean template name
    let defaultTemplateName = "Imported Spectora Template";
    if (options.templateName) {
      defaultTemplateName = options.templateName;
    } else if (options.sourceFilename) {
      defaultTemplateName = options.sourceFilename.replace(/\.[^/.]+$/, "");
    }

    const templateDraft: ParsedTemplateDraft = {
      name: defaultTemplateName,
      description: `Imported from Spectora export (${rows.length} rows, ${sections.length} sections)`,
      originalSource: "spectora-html-import",
      sourceFilename: options.sourceFilename || null,
      sourceMetadata: {
        totalSourceRows: rows.length,
        importedAt: new Date().toISOString(),
      },
      sections,
      warnings: allWarnings,
    };

    return {
      template: templateDraft,
      warnings: allWarnings,
    };
  }
}

export const spectoraNormalizer = new SpectoraNormalizer();
