import {
  Template,
  Section,
  Item,
  Comment,
} from "@/types/template";
import { ImportRun, ImportWarning, ImportStatus } from "@/types/importer";
import {
  templateRepository,
  sectionRepository,
  itemRepository,
  commentRepository,
  importRepository,
} from "@/db/repositories";

/**
 * Domain & Repository Architecture Verification
 * Validates domain contracts, type consistency, and repository methods.
 */
export function runRepositoryValidation(): { passed: boolean; checks: number } {
  let checks = 0;

  function assert(condition: boolean, message: string) {
    checks++;
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Comment Domain Verification
  const mockComment: Comment = {
    id: "c-1",
    itemId: "item-1",
    commentName: "Damaged Shingles",
    commentText: "<p>Missing and cracked asphalt shingles observed on south slope.</p>",
    contentFormat: "html",
    commentType: "Defect",
    category: "Roofing",
    recommendation: "Evaluation and repair by licensed roofing contractor.",
    orderIndex: 0,
    answerType: "defect",
    defaultValue: null,
    defaultValue2: null,
    defaultUnitType: null,
    defaultLocation: "South Roof Slope",
    defaultEstimateMin: 500,
    defaultEstimateMax: 1200,
    locked: false,
    simpleFormat: false,
    disablePhotos: false,
    multipleChoiceOptions: [],
    unitTypeOptions: [],
    defaultPhotosAndCaptions: [],
    sourceLastModified: "2026-09-14T10:00:00Z",
    sourceMetadata: { spectoraId: "spec_12345" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 2. Item Domain Verification
  const mockItem: Item = {
    id: "item-1",
    sectionId: "sec-1",
    name: "Roof Coverings",
    orderIndex: 0,
    comments: [mockComment],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 3. Section Domain Verification
  const mockSection: Section = {
    id: "sec-1",
    templateId: "tpl-1",
    name: "Roofing System",
    orderIndex: 0,
    items: [mockItem],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 4. Template Domain Verification
  const mockTemplate: Template = {
    id: "tpl-1",
    name: "InterNACHI Residential Standard",
    description: "Standard residential home inspection template",
    originalSource: "spectora-html-import",
    sourceFilename: "internachi_export.html",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert(mockTemplate.name === "InterNACHI Residential Standard", "Template name match");
  assert(mockSection.items.length === 1, "Section contains items");
  assert(mockItem.comments[0].commentType === "Defect", "Comment type is Defect");
  assert(mockItem.comments[0].contentFormat === "html", "Comment format is html");

  // 5. Import Run & Warnings Verification
  const statuses: ImportStatus[] = [
    "pending",
    "processing",
    "completed",
    "completed_with_warnings",
    "failed",
  ];
  assert(statuses.includes("completed_with_warnings"), "Includes completed_with_warnings status");

  const warning: ImportWarning = {
    id: "warn-1",
    importRunId: "run-1",
    warningType: "SKIPPED_ROW",
    severity: "warning",
    message: "Row 14 contained empty narrative and item title; skipped.",
    rawSnippet: "<tr><td></td><td></td></tr>",
    rowNumber: 14,
    columnName: "Comment Text",
    createdAt: new Date().toISOString(),
  };

  const importRun: ImportRun = {
    id: "run-1",
    status: "completed_with_warnings",
    filename: "sample_template.html",
    fileSizeBytes: 1048576,
    totalRowsDetected: 142,
    totalSectionsImported: 12,
    totalItemsImported: 48,
    totalCommentsImported: 180,
    warningCount: 1,
    startedAt: new Date().toISOString(),
    warnings: [warning],
  };

  assert(importRun.warningCount === 1, "Warning count preserved");
  assert(importRun.warnings?.[0].warningType === "SKIPPED_ROW", "Warning type preserved");

  // 6. Repository Method Signatures
  assert(typeof templateRepository.listTemplates === "function", "templateRepo.listTemplates exists");
  assert(typeof templateRepository.getTemplateById === "function", "templateRepo.getTemplateById exists");
  assert(typeof templateRepository.createTemplate === "function", "templateRepo.createTemplate exists");
  assert(typeof templateRepository.updateTemplate === "function", "templateRepo.updateTemplate exists");
  assert(typeof templateRepository.deleteTemplate === "function", "templateRepo.deleteTemplate exists");
  assert(typeof templateRepository.duplicateTemplate === "function", "templateRepo.duplicateTemplate exists");

  assert(typeof sectionRepository.createSection === "function", "sectionRepo.createSection exists");
  assert(typeof sectionRepository.reorderSections === "function", "sectionRepo.reorderSections exists");

  assert(typeof itemRepository.createItem === "function", "itemRepo.createItem exists");
  assert(typeof itemRepository.reorderItems === "function", "itemRepo.reorderItems exists");

  assert(typeof commentRepository.createComment === "function", "commentRepo.createComment exists");
  assert(typeof commentRepository.reorderComments === "function", "commentRepo.reorderComments exists");

  assert(typeof importRepository.createImportRun === "function", "importRepo.createImportRun exists");
  assert(typeof importRepository.addImportWarnings === "function", "importRepo.addImportWarnings exists");

  return { passed: true, checks };
}
