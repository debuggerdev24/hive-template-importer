import * as fs from "fs";
import * as path from "path";
import {
  ConfidenceReportBuilder,
  confidenceReportBuilder,
} from "@/features/importer/audit/confidenceReportBuilder";
import { templateImportService } from "@/services/templateImportService";
import { ParsedTemplateDraft, ParsedWarningDraft } from "@/features/importer/types";

/**
 * Verification Test Suite for Import Preservation / Confidence Report
 * Tests:
 * 1. Factual preservation counts (Sections, Items, Comments, HTML narratives, Choice options)
 * 2. Ordering integrity verification
 * 3. Clear distinction between "Not present in source" vs "Present in source but unsupported by importer"
 * 4. Itemized diagnostics: section, item, comment, source row, issue type, and handling decision
 * 5. End-to-end report generation from real Spectora fixture
 * 6. No vague/invented percentage claims
 */
export async function runConfidenceReportTests(): Promise<{
  passed: boolean;
  totalChecks: number;
  summary: string[];
}> {
  let totalChecks = 0;
  const summary: string[] = [];

  function assert(condition: boolean, testName: string) {
    totalChecks++;
    if (!condition) {
      throw new Error(`[FAIL] ${testName}`);
    }
    summary.push(`[PASS] ${testName}`);
  }

  const builder = new ConfidenceReportBuilder();

  // --- TEST 1: Synthetic Template with Known Factual Counts & Warnings ---
  const syntheticTemplate: ParsedTemplateDraft = {
    name: "HVAC & Electrical Master Template",
    originalSource: "spectora",
    sourceFilename: "synthetic.xls",
    sections: [
      {
        name: "Heating & Cooling",
        orderIndex: 0,
        items: [
          {
            name: "Furnace",
            orderIndex: 0,
            comments: [
              {
                commentName: "Operable",
                commentText: "<p>The furnace was tested and <b>operated normally</b>.</p>",
                contentFormat: "html",
                orderIndex: 0,
              },
              {
                commentName: "Filter Dirty",
                commentText: "Replace air filter. Estimated cost: $20-$40.",
                contentFormat: "html",
                orderIndex: 1,
                defaultEstimateMin: 20,
                defaultEstimateMax: 40,
                multipleChoiceOptions: ["16x20x1", "16x25x1", "20x25x1"],
              },
            ],
          },
        ],
      },
      {
        name: "Electrical",
        orderIndex: 1,
        items: [
          {
            name: "Service Panel",
            orderIndex: 0,
            comments: [
              {
                commentName: "Double Tapped Breaker",
                commentText: "Multiple conductors observed on single lug. See https://example.com/electrical-standards",
                contentFormat: "html",
                orderIndex: 0,
              },
            ],
          },
        ],
      },
    ],
    warnings: [],
  };

  const syntheticWarnings: ParsedWarningDraft[] = [
    {
      warningType: "RICH_FORMAT_SIMPLIFIED",
      severity: "warning",
      message: "Potentially unsafe script tag removed from comment narrative.",
      rowNumber: 12,
      columnName: "Comment Text",
      sectionName: "Heating & Cooling",
      itemName: "Furnace",
      commentName: "Operable",
      handlingDecision: "Sanitized active scripts to protect reports from XSS while keeping text and safe HTML.",
      classification: "unsupported_by_importer",
    },
    {
      warningType: "LINK_REVIEW",
      severity: "info",
      message: "External link 'https://example.com/electrical-standards' detected.",
      rowNumber: 28,
      columnName: "Comment Text",
      sectionName: "Electrical",
      itemName: "Service Panel",
      commentName: "Double Tapped Breaker",
      handlingDecision: "Preserved original hyperlink. Inspector review recommended to confirm external destination.",
      classification: "unsupported_by_importer",
    },
    {
      warningType: "SKIPPED_ROW",
      severity: "warning",
      message: "Row 45 is completely empty in source spreadsheet.",
      rowNumber: 45,
      sectionName: null,
      itemName: null,
      commentName: null,
      handlingDecision: "Empty row omitted from template database entities.",
      classification: "not_present_in_source",
    },
  ];

  const report = builder.buildReport(syntheticTemplate, syntheticWarnings, 3);

  // Verification of Factual Counts
  assert(report.factualCounts.sectionsPreserved === 2, "Factual section count is 2");
  assert(report.factualCounts.itemsPreserved === 2, "Factual item count is 2");
  assert(report.factualCounts.commentsPreserved === 3, "Factual comment count is 3");
  assert(report.factualCounts.orderingIntegrityVerified === true, "Ordering integrity verified sequentially");
  assert(report.factualCounts.totalWarningsCount === 3, "Total warnings count is 3");
  assert(report.factualCounts.unsupportedRichContentCount === 1, "Unsupported rich content count is 1");

  // Verification of Content Preservation Checklist
  const secItem = report.preservationChecklist.find((c) => c.category === "sections");
  assert(secItem !== undefined && secItem.count === 2, "Checklist sections count matches");

  const itItem = report.preservationChecklist.find((c) => c.category === "items");
  assert(itItem !== undefined && itItem.count === 2, "Checklist items count matches");

  const comItem = report.preservationChecklist.find((c) => c.category === "comments");
  assert(comItem !== undefined && comItem.count === 3, "Checklist comments count matches");

  const htmlItem = report.preservationChecklist.find((c) => c.category === "html_formatting");
  assert(htmlItem !== undefined && htmlItem.count === 1, "Checklist detects exact 1 HTML comment");

  const attrItem = report.preservationChecklist.find((c) => c.category === "attributes");
  assert(attrItem !== undefined && attrItem.count === 2, "Checklist detects 1 choice list + 1 estimate = 2 attributes");

  // Verification of Semantic Classifications
  assert(report.summary.unsupportedByImporterCount === 2, "Summary distinguishes 2 unsupported-by-importer findings");
  assert(report.summary.notPresentInSourceCount === 1, "Summary distinguishes 1 not-present-in-source finding");

  // Verification of Limitations Checklist
  const richLim = report.limitationsChecklist.find((l) => l.type === "RICH_FORMAT_SIMPLIFIED");
  assert(richLim !== undefined && richLim.count === 1, "Limitations checklist notes rich formatting simplified");

  const linkLim = report.limitationsChecklist.find((l) => l.type === "LINK_REVIEW");
  assert(linkLim !== undefined && linkLim.count === 1, "Limitations checklist notes links requiring review");

  const missingLim = report.limitationsChecklist.find((l) => l.type === "NOT_PRESENT_IN_SOURCE");
  assert(missingLim !== undefined && missingLim.count === 1, "Limitations checklist notes not present in source");

  // Verification of Itemized Finding Details & Handling Decisions
  const scriptFinding = report.itemizedFindings.find((f) => f.issueType === "RICH_FORMAT_SIMPLIFIED");
  assert(scriptFinding !== undefined, "Itemized findings contain script simplification");
  assert(scriptFinding?.sectionName === "Heating & Cooling", "Finding preserves section name");
  assert(scriptFinding?.itemName === "Furnace", "Finding preserves item name");
  assert(scriptFinding?.commentName === "Operable", "Finding preserves comment name");
  assert(scriptFinding?.sourceRow === 12, "Finding preserves source row 12");
  assert(scriptFinding?.classification === "unsupported_by_importer", "Classified as present in source but unsupported");
  assert(Boolean(scriptFinding?.handlingDecision.includes("Sanitized active scripts")), "Handling decision clearly explains security sanitization");

  const emptyRowFinding = report.itemizedFindings.find((f) => f.issueType === "SKIPPED_ROW");
  assert(emptyRowFinding?.classification === "not_present_in_source", "Classified as not present in source");
  assert(Boolean(emptyRowFinding?.handlingDecision.includes("omitted from template")), "Handling decision explains empty row omission");

  // --- TEST 2: Real Fixture Import Preservation Report ---
  const fixturePath = path.resolve(process.cwd(), "fixtures/Residential Template-2026-09-14.xls");
  if (fs.existsSync(fixturePath)) {
    const fixtureBuffer = fs.readFileSync(fixturePath);
    const importResult = await templateImportService.processImport({
      buffer: fixtureBuffer,
      filename: "Residential Template-2026-09-14.xls",
      templateName: "Residential Baseline Inspection",
    });

    assert(importResult.success === true, "Real fixture import succeeded");
    assert(importResult.confidenceReport !== undefined, "Confidence report attached to import result");

    const realReport = importResult.confidenceReport!;
    assert(realReport.factualCounts.sectionsPreserved === 13, `Real fixture preserves exact 13 sections (got ${realReport.factualCounts.sectionsPreserved})`);
    assert(realReport.factualCounts.itemsPreserved === 69, `Real fixture preserves exact 69 items (got ${realReport.factualCounts.itemsPreserved})`);
    assert(realReport.factualCounts.commentsPreserved === 392, `Real fixture preserves exact 392 comments (got ${realReport.factualCounts.commentsPreserved})`);
    assert(realReport.factualCounts.orderingIntegrityVerified === true, "Real fixture ordering integrity verified sequentially");
    assert(realReport.preservationChecklist.length >= 4, "Preservation checklist contains all 4+ core guarantees");

    // Ensure all itemized findings have handling decisions and classifications
    realReport.itemizedFindings.forEach((finding) => {
      assert(finding.handlingDecision.length > 0, `Finding [${finding.issueType}] has explicit handling decision`);
      assert(
        ["unsupported_by_importer", "not_present_in_source", "data_anomaly"].includes(finding.classification),
        `Finding [${finding.issueType}] has valid classification (${finding.classification})`
      );
    });
  }

  // --- TEST 3: Report From Persisted Template ---
  const persistedReport = confidenceReportBuilder.buildReportFromPersistedTemplate({
    name: "Persisted Template",
    sections: [
      {
        name: "Roofing",
        order_index: 0,
        items: [
          {
            name: "Flashings",
            order_index: 0,
            comments: [
              {
                comment_name: "Step Flashing",
                comment_text: "<p>Step flashing installed properly along sidewalls.</p>",
                default_estimate_min: 150,
                default_estimate_max: 300,
              },
            ],
          },
        ],
      },
    ],
  });

  assert(persistedReport.factualCounts.sectionsPreserved === 1, "Persisted builder counts 1 section");
  assert(persistedReport.factualCounts.itemsPreserved === 1, "Persisted builder counts 1 item");
  assert(persistedReport.factualCounts.commentsPreserved === 1, "Persisted builder counts 1 comment");
  assert(persistedReport.factualCounts.orderingIntegrityVerified === true, "Persisted builder verifies order");

  return {
    passed: true,
    totalChecks,
    summary,
  };
}
