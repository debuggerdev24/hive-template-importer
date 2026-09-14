import { ParsedTemplateDraft, ParsedWarningDraft } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: ParsedWarningDraft[];
  stats: {
    sectionCount: number;
    itemCount: number;
    commentCount: number;
    warningCount: number;
  };
}

export class TemplateValidator {
  /**
   * Validates structural integrity of a parsed template draft
   */
  validate(template: ParsedTemplateDraft): ValidationResult {
    const errors: string[] = [];
    const warnings: ParsedWarningDraft[] = [...template.warnings];

    // 1. Template level validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push("Missing required field: Template must have a non-empty name.");
    }

    if (!template.sections || template.sections.length === 0) {
      errors.push(
        "Missing required structure: The template contains zero sections. Please ensure your Spectora file contains defined inspection sections."
      );
    }

    let totalItems = 0;
    let totalComments = 0;

    // 2. Section level validation
    (template.sections || []).forEach((sec, sIdx) => {
      if (!sec.name || sec.name.trim().length === 0) {
        errors.push(`Missing required field: Section at index ${sIdx} is missing a name.`);
      }

      if (sec.orderIndex < 0) {
        warnings.push({
          warningType: "OTHER",
          severity: "info",
          message: `Section '${sec.name}' has negative order index ${sec.orderIndex}. Resetting to ${sIdx}.`,
        });
        sec.orderIndex = sIdx;
      }

      // 3. Item level validation
      (sec.items || []).forEach((it, iIdx) => {
        totalItems++;

        if (!it.name || it.name.trim().length === 0) {
          errors.push(`Missing required field: Item at index ${iIdx} in section '${sec.name || `Section ${sIdx}`}' is missing a name.`);
        }

        // 4. Comment level validation
        (it.comments || []).forEach((c) => {
          totalComments++;
          if (c.orderIndex < 0) {
            c.orderIndex = 0;
          }
        });
      });
    });

    if (totalItems === 0) {
      errors.push(
        "Missing required structure: The template contains zero checklist items. Please ensure your Spectora export contains items under its sections."
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        sectionCount: template.sections.length,
        itemCount: totalItems,
        commentCount: totalComments,
        warningCount: warnings.length,
      },
    };
  }
}

export const templateValidator = new TemplateValidator();
