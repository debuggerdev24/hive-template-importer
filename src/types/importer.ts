import { ContentFormat, CommentOption, PhotoAttachment } from "./template";

export type ImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_warnings"
  | "failed";

export type WarningSeverity = "info" | "warning" | "error";

export type WarningClassification =
  | "unsupported_by_importer"
  | "not_present_in_source"
  | "data_anomaly";

export type ImportWarningType =
  | "UNSUPPORTED_COLUMN"
  | "SKIPPED_ROW"
  | "UNMATCHED_TAG"
  | "TRUNCATED_TEXT"
  | "ORPHAN_ENTRY"
  | "EMPTY_REQUIRED_FIELD"
  | "RICH_FORMAT_SIMPLIFIED"
  | "LINK_REVIEW"
  | "UNSUPPORTED_ELEMENT"
  | "OTHER";

export interface ImportWarning {
  id: string;
  importRunId: string;
  warningType: ImportWarningType | string;
  severity: WarningSeverity;
  message: string;
  rawSnippet?: string | null;
  rowNumber?: number | null;
  columnName?: string | null;
  sectionName?: string | null;
  itemName?: string | null;
  commentName?: string | null;
  handlingDecision?: string | null;
  classification?: WarningClassification;
  createdAt: string;
}

export interface ImportRun {
  id: string;
  templateId?: string | null;
  status: ImportStatus;
  filename: string;
  fileSizeBytes?: number | null;
  fileFormat?: string | null;
  totalRowsDetected: number;
  totalSectionsImported: number;
  totalItemsImported: number;
  totalCommentsImported: number;
  warningCount: number;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  warnings?: ImportWarning[];
}

export interface ParsedCommentDraft {
  commentName?: string | null;
  commentText: string;
  contentFormat: ContentFormat;
  commentType?: string | null;
  category?: string | null;
  recommendation?: string | null;
  orderIndex: number;
  answerType?: string | null;
  defaultValue?: string | null;
  defaultValue2?: string | null;
  defaultUnitType?: string | null;
  defaultLocation?: string | null;
  defaultEstimateMin?: number | null;
  defaultEstimateMax?: number | null;
  locked?: boolean;
  simpleFormat?: boolean;
  disablePhotos?: boolean;
  multipleChoiceOptions?: CommentOption[] | string[];
  unitTypeOptions?: string[];
  defaultPhotosAndCaptions?: PhotoAttachment[];
  sourceLastModified?: string | null;
  sourceMetadata?: Record<string, unknown>;
}

export interface ParsedItemDraft {
  name: string;
  orderIndex: number;
  comments: ParsedCommentDraft[];
  sourceMetadata?: Record<string, unknown>;
}

export interface ParsedSectionDraft {
  name: string;
  orderIndex: number;
  items: ParsedItemDraft[];
  sourceMetadata?: Record<string, unknown>;
}

export interface ParsedWarningDraft {
  warningType: ImportWarningType | string;
  severity: WarningSeverity;
  message: string;
  rawSnippet?: string | null;
  rowNumber?: number | null;
  columnName?: string | null;
  sectionName?: string | null;
  itemName?: string | null;
  commentName?: string | null;
  handlingDecision?: string | null;
  classification?: WarningClassification;
}

export interface ParsedTemplateDraft {
  name: string;
  description?: string | null;
  originalSource: string;
  sourceFilename?: string | null;
  sourceMetadata?: Record<string, unknown>;
  sections: ParsedSectionDraft[];
  warnings: ParsedWarningDraft[];
}
