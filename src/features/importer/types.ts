import type {
  ContentFormat,
  CommentOption,
  PhotoAttachment,
} from "@/types/template";
import type {
  ImportWarningType,
  WarningSeverity,
  ParsedTemplateDraft,
  ParsedSectionDraft,
  ParsedItemDraft,
  ParsedCommentDraft,
  ParsedWarningDraft,
} from "@/types/importer";

export interface RawSpectoraRow {
  rowNumber: number;
  cells: Record<string, string>;
  rawValues: string[];
}

export interface RawSpectoraSheet {
  sheetName: string;
  headers: string[];
  rows: RawSpectoraRow[];
}

export interface ParsedSpectoraRow {
  rowNumber: number;
  sectionName: string;
  itemName: string;
  commentName: string | null;
  commentText: string;
  contentFormat: ContentFormat;
  commentType: string | null;
  category: string | null;
  multipleChoiceOptions: string[];
  unitTypeOptions: string[];
  recommendation: string | null;
  orderIndex: number;
  answerType: string | null;
  defaultValue: string | null;
  defaultValue2: string | null;
  defaultUnitType: string | null;
  defaultLocation: string | null;
  defaultEstimateMin: number | null;
  defaultEstimateMax: number | null;
  locked: boolean;
  simpleFormat: boolean;
  disablePhotos: boolean;
  uses: number;
  defaultPhotosAndCaptions: PhotoAttachment[];
  sourceLastModified: string | null;
  sourceMetadata: Record<string, unknown>;
  warnings: ParsedWarningDraft[];
}

export interface ImporterResult {
  success: boolean;
  template: ParsedTemplateDraft;
  warnings: ParsedWarningDraft[];
  metrics: {
    totalRowsProcessed: number;
    sectionsCreated: number;
    itemsCreated: number;
    commentsCreated: number;
    warningsCount: number;
  };
  errors: string[];
}

export type {
  ParsedTemplateDraft,
  ParsedSectionDraft,
  ParsedItemDraft,
  ParsedCommentDraft,
  ParsedWarningDraft,
  ImportWarningType,
  WarningSeverity,
  CommentOption,
  PhotoAttachment,
};
