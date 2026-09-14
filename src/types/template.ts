/**
 * Core Domain Models for Hive Inspect Templates
 *
 * Normalized Relational Hierarchy:
 * Template -> Section -> Item -> Comment
 *
 * Preserves all rich Spectora export fields rather than discarding them.
 */

export type ContentFormat = "html" | "plain_text" | "markdown";

export interface CommentOption {
  label: string;
  value?: string;
}

export interface PhotoAttachment {
  url?: string;
  caption?: string;
  filename?: string;
}

export interface Comment {
  id: string;
  itemId: string;
  commentName?: string | null;
  commentText: string;
  contentFormat: ContentFormat;
  commentType?: string | null;      // e.g. "Defect", "Information", "Limitation", "Safety"
  category?: string | null;         // Spectora Category
  recommendation?: string | null;
  orderIndex: number;
  answerType?: string | null;
  defaultValue?: string | null;
  defaultValue2?: string | null;
  defaultUnitType?: string | null;
  defaultLocation?: string | null;
  defaultEstimateMin?: number | null;
  defaultEstimateMax?: number | null;
  locked: boolean;
  simpleFormat: boolean;
  disablePhotos: boolean;
  multipleChoiceOptions?: CommentOption[] | string[];
  unitTypeOptions?: string[];
  defaultPhotosAndCaptions?: PhotoAttachment[];
  sourceLastModified?: string | null;
  sourceMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  sectionId: string;
  name: string;
  orderIndex: number;
  comments: Comment[];
  sourceMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  templateId: string;
  name: string;
  orderIndex: number;
  items: Item[];
  sourceMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  originalSource: string; // "spectora-html-import" | "clone:<id>" | "manual"
  sourceFilename?: string | null;
  sourceMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateWithRelations extends Template {
  sections: Section[];
  _count?: {
    sections: number;
    items: number;
    comments: number;
  };
}

export interface TemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  originalSource: string;
  sourceFilename?: string | null;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  itemCount: number;
  commentCount: number;
  importStatus?: string | null;
  warningCount?: number;
}
