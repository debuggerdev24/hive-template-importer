import {
  RawSpectoraSheet,
  RawSpectoraRow,
  ParsedSpectoraRow,
  ParsedWarningDraft,
} from "../types";
import { sanitizeHtml } from "@/utils/sanitize";

export interface ColumnIndexes {
  sectionName: string | null;
  itemName: string | null;
  commentName: string | null;
  commentText: string | null;
  commentType: string | null;
  category: string | null;
  multipleChoiceOptions: string | null;
  unitTypeOptions: string | null;
  recommendation: string | null;
  orderWithinItem: string | null;
  answerType: string | null;
  defaultValue: string | null;
  defaultValue2: string | null;
  defaultUnitType: string | null;
  defaultLocation: string | null;
  defaultEstimateMin: string | null;
  defaultEstimateMax: string | null;
  locked: string | null;
  simpleFormat: string | null;
  disablePhotos: string | null;
  uses: string | null;
  lastModified: string | null;
  photoColumns: Array<{ urlCol: string; captionCol?: string }>;
}

export class SpectoraParser {
  /**
   * Identifies columns dynamically using fuzzy/pattern matching
   */
  detectColumns(headers: string[]): ColumnIndexes {
    const findCol = (predicate: (h: string) => boolean): string | null => {
      const match = headers.find((h) => predicate(h.toLowerCase().trim()));
      return match || null;
    };

    const sectionName = findCol((h) => h === "section name" || h.startsWith("section"));
    const itemName = findCol((h) => h === "item name" || h.startsWith("item"));
    const commentName = findCol((h) => h === "comment name" || h === "name" || h === "title");
    const commentText = findCol((h) => h === "comment text" || h.includes("narrative") || h === "comment");
    const commentType = findCol((h) => h.includes("comment type"));
    const category = findCol((h) => h.includes("category"));
    const multipleChoiceOptions = findCol((h) => h.includes("multiple choice"));
    const unitTypeOptions = findCol((h) => h.includes("unit type options"));
    const recommendation = findCol((h) => h.includes("recommendation"));
    const orderWithinItem = findCol((h) => h.includes("order (w/i item)") || h.includes("order"));
    const answerType = findCol((h) => h.includes("answer type"));
    const defaultValue = findCol((h) => h === "default value");
    const defaultValue2 = findCol((h) => h.includes("default value 2"));
    const defaultUnitType = findCol((h) => h.includes("default unit type"));
    const defaultLocation = findCol((h) => h.includes("default location"));
    const defaultEstimateMin = findCol((h) => h.includes("estimate min"));
    const defaultEstimateMax = findCol((h) => h.includes("estimate max"));
    const locked = findCol((h) => h === "locked");
    const simpleFormat = findCol((h) => h.includes("simple format"));
    const disablePhotos = findCol((h) => h.includes("disable photos"));
    const uses = findCol((h) => h === "uses");
    const lastModified = findCol((h) => h.includes("last modified"));

    // Detect Photo 1..10 and Photo 1..10 Caption columns
    const photoColumns: Array<{ urlCol: string; captionCol?: string }> = [];
    for (let i = 1; i <= 10; i++) {
      const urlCol = findCol((h) => h === `default photo ${i}`);
      const captionCol = findCol((h) => h === `default photo ${i} caption`);
      if (urlCol) {
        photoColumns.push({ urlCol, captionCol: captionCol ?? undefined });
      }
    }

    return {
      sectionName,
      itemName,
      commentName,
      commentText,
      commentType,
      category,
      multipleChoiceOptions,
      unitTypeOptions,
      recommendation,
      orderWithinItem,
      answerType,
      defaultValue,
      defaultValue2,
      defaultUnitType,
      defaultLocation,
      defaultEstimateMin,
      defaultEstimateMax,
      locked,
      simpleFormat,
      disablePhotos,
      uses,
      lastModified,
      photoColumns,
    };
  }

  /**
   * Parses raw rows into typed intermediate Spectora row representations
   */
  parseSheet(sheet: RawSpectoraSheet): {
    parsedRows: ParsedSpectoraRow[];
    globalWarnings: ParsedWarningDraft[];
  } {
    // 1. Guard against empty spreadsheet
    if (!sheet.rows || sheet.rows.length === 0) {
      throw new Error(
        "Empty spreadsheet: The provided file contains 0 data rows. Please ensure you exported a populated template from Spectora."
      );
    }

    const colMap = this.detectColumns(sheet.headers);
    const globalWarnings: ParsedWarningDraft[] = [];

    // 2. Verify minimum required structural columns exist
    if (!colMap.sectionName && !colMap.itemName) {
      throw new Error(
        "Missing Spectora template structure: Neither 'Section Name' nor 'Item Name' header columns were detected in the spreadsheet. Please verify this file was exported directly from Spectora (Settings > Templates > Export) and try again."
      );
    }

    // Detect unrecognized columns in header
    const recognizedCols = new Set<string>();
    Object.values(colMap).forEach((val) => {
      if (typeof val === "string") recognizedCols.add(val.toLowerCase().trim());
    });
    colMap.photoColumns.forEach(({ urlCol, captionCol }) => {
      recognizedCols.add(urlCol.toLowerCase().trim());
      if (captionCol) recognizedCols.add(captionCol.toLowerCase().trim());
    });

    sheet.headers.forEach((hdr) => {
      const normalizedHdr = hdr.toLowerCase().trim();
      if (normalizedHdr && !recognizedCols.has(normalizedHdr)) {
        globalWarnings.push({
          warningType: "UNSUPPORTED_COLUMN",
          severity: "info",
          message: `Column '${hdr}' is not part of standard relational schema. Preserved in sourceMetadata JSONB.`,
          columnName: hdr,
          handlingDecision: "Preserved inside sourceMetadata JSONB to prevent any customer data loss.",
          classification: "unsupported_by_importer",
        });
      }
    });

    const parsedRows: ParsedSpectoraRow[] = [];

    sheet.rows.forEach((row, idx) => {
      const parsed = this.parseRow(row, colMap, idx);
      parsedRows.push(parsed);
    });

    return { parsedRows, globalWarnings };
  }

  private parseRow(
    row: RawSpectoraRow,
    cols: ColumnIndexes,
    rowIndex: number
  ): ParsedSpectoraRow {
    const warnings: ParsedWarningDraft[] = [];

    const getVal = (col: string | null): string => {
      if (!col) return "";
      return (row.cells[col] || "").trim();
    };

    let sectionName = getVal(cols.sectionName);
    let itemName = getVal(cols.itemName);
    const commentNameRaw = getVal(cols.commentName);
    const commentName = commentNameRaw ? commentNameRaw : null;
    let commentText = getVal(cols.commentText);

    // 1. Detect completely empty row
    const nonBlankCount = Object.values(row.cells).filter((v) => v.trim().length > 0).length;
    if (nonBlankCount === 0) {
      warnings.push({
        warningType: "SKIPPED_ROW",
        severity: "warning",
        message: `Row ${row.rowNumber} is completely empty in source spreadsheet.`,
        rowNumber: row.rowNumber,
        sectionName: null,
        itemName: null,
        commentName: null,
        handlingDecision: "Empty row omitted from template database entities.",
        classification: "not_present_in_source",
      });
    }

    // 2. Structural checks: Missing Section or Item names
    if (!sectionName && (itemName || commentName || commentText)) {
      sectionName = "General / Uncategorized";
      warnings.push({
        warningType: "ORPHAN_ENTRY",
        severity: "warning",
        message: `Row ${row.rowNumber} has no Section Name. Assigned to fallback '${sectionName}'.`,
        rowNumber: row.rowNumber,
        columnName: "Section Name",
        sectionName: "(Empty in source)",
        itemName: itemName || null,
        commentName,
        handlingDecision: `Assigned finding to fallback section '${sectionName}' rather than discarding customer data.`,
        classification: "not_present_in_source",
      });
    }

    if (!itemName && (commentName || commentText)) {
      itemName = "General";
      warnings.push({
        warningType: "ORPHAN_ENTRY",
        severity: "warning",
        message: `Row ${row.rowNumber} has no Item Name. Assigned to fallback item '${itemName}'.`,
        rowNumber: row.rowNumber,
        columnName: "Item Name",
        sectionName: sectionName || null,
        itemName: "(Empty in source)",
        commentName,
        handlingDecision: `Assigned finding to fallback item '${itemName}' rather than discarding customer data.`,
        classification: "not_present_in_source",
      });
    }

    // 3. Order index extraction
    let orderIndex = rowIndex;
    const orderStr = getVal(cols.orderWithinItem);
    if (orderStr) {
      const parsedOrder = parseInt(orderStr, 10);
      if (!isNaN(parsedOrder)) {
        orderIndex = parsedOrder;
      } else {
        warnings.push({
          warningType: "UNSUPPORTED_COLUMN",
          severity: "info",
          message: `Non-numeric order index '${orderStr}' at row ${row.rowNumber}. Derived sequentially.`,
          rowNumber: row.rowNumber,
          columnName: "Order (w/i item)",
          sectionName: sectionName || null,
          itemName: itemName || null,
          commentName,
          handlingDecision: "Normalized to sequential appearance index preserving original visual order.",
          classification: "unsupported_by_importer",
        });
      }
    }

    // 4. HTML sanitization & Rich formatting simplification
    if (commentText) {
      const sanitized = sanitizeHtml(commentText);
      if (sanitized !== commentText) {
        warnings.push({
          warningType: "RICH_FORMAT_SIMPLIFIED",
          severity: "warning",
          message: `Potentially unsafe or unsupported rich elements sanitized in comment text at row ${row.rowNumber}.`,
          rawSnippet: commentText.slice(0, 150),
          rowNumber: row.rowNumber,
          columnName: "Comment Text",
          sectionName: sectionName || null,
          itemName: itemName || null,
          commentName,
          handlingDecision: "Sanitized active scripts/embeds to protect inspection reports from XSS while preserving text and safe markup.",
          classification: "unsupported_by_importer",
        });
        commentText = sanitized;
      }

      // 5. Links requiring review
      const linkMatch = commentText.match(/https?:\/\/[^\s<"']+/i);
      if (linkMatch) {
        warnings.push({
          warningType: "LINK_REVIEW",
          severity: "info",
          message: `External link '${linkMatch[0]}' detected in comment narrative.`,
          rawSnippet: linkMatch[0],
          rowNumber: row.rowNumber,
          columnName: "Comment Text",
          sectionName: sectionName || null,
          itemName: itemName || null,
          commentName,
          handlingDecision: "Preserved original hyperlink. Inspector review recommended to ensure destination is active.",
          classification: "unsupported_by_importer",
        });
      }
    }

    // 6. Answer Type normalization
    const answerTypeRaw = getVal(cols.answerType);
    const answerType = answerTypeRaw ? answerTypeRaw.toLowerCase() : null;
    if (answerType && !["multiple_choice", "checkbox", "text", "number", "date", ""].includes(answerType)) {
      warnings.push({
        warningType: "UNSUPPORTED_ELEMENT",
        severity: "info",
        message: `Specialized answer type '${answerTypeRaw}' mapped to standard finding comment.`,
        rowNumber: row.rowNumber,
        columnName: "Answer Type",
        sectionName: sectionName || null,
        itemName: itemName || null,
        commentName,
        handlingDecision: "Retained answer type in finding attributes while preserving comment text and checkbox functionality.",
        classification: "unsupported_by_importer",
      });
    }

    // 6. Multiple choice options
    const mcStr = getVal(cols.multipleChoiceOptions);
    const multipleChoiceOptions = mcStr
      ? mcStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // 7. Unit type options
    const utStr = getVal(cols.unitTypeOptions);
    const unitTypeOptions = utStr
      ? utStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // 8. Photo collections
    const defaultPhotosAndCaptions: Array<{ url?: string; caption?: string }> = [];
    cols.photoColumns.forEach(({ urlCol, captionCol }) => {
      const url = getVal(urlCol);
      const caption = captionCol ? getVal(captionCol) : undefined;
      if (url) {
        defaultPhotosAndCaptions.push({ url, caption: caption || undefined });
      }
    });

    // 9. Numeric parse for estimates
    const minEstStr = getVal(cols.defaultEstimateMin);
    const maxEstStr = getVal(cols.defaultEstimateMax);
    const defaultEstimateMin = minEstStr && !isNaN(Number(minEstStr)) ? Number(minEstStr) : null;
    const defaultEstimateMax = maxEstStr && !isNaN(Number(maxEstStr)) ? Number(maxEstStr) : null;

    // 10. Booleans
    const locked = this.parseBoolean(getVal(cols.locked));
    const simpleFormat = this.parseBoolean(getVal(cols.simpleFormat));
    const disablePhotos = this.parseBoolean(getVal(cols.disablePhotos));

    // 11. Uses
    const usesStr = getVal(cols.uses);
    const uses = usesStr && !isNaN(parseInt(usesStr, 10)) ? parseInt(usesStr, 10) : 0;

    return {
      rowNumber: row.rowNumber,
      sectionName: sectionName || "General",
      itemName: itemName || "General",
      commentName,
      commentText,
      contentFormat: "html",
      commentType: getVal(cols.commentType) || "info",
      category: getVal(cols.category) || null,
      multipleChoiceOptions,
      unitTypeOptions,
      recommendation: getVal(cols.recommendation) || null,
      orderIndex,
      answerType,
      defaultValue: getVal(cols.defaultValue) || null,
      defaultValue2: getVal(cols.defaultValue2) || null,
      defaultUnitType: getVal(cols.defaultUnitType) || null,
      defaultLocation: getVal(cols.defaultLocation) || null,
      defaultEstimateMin,
      defaultEstimateMax,
      locked,
      simpleFormat,
      disablePhotos,
      uses,
      defaultPhotosAndCaptions,
      sourceLastModified: getVal(cols.lastModified) || null,
      sourceMetadata: {
        rawRowNumber: row.rowNumber,
        uses,
      },
      warnings,
    };
  }

  private parseBoolean(val: string): boolean {
    const lower = val.toLowerCase().trim();
    return lower === "true" || lower === "1" || lower === "yes";
  }
}

export const spectoraParser = new SpectoraParser();
