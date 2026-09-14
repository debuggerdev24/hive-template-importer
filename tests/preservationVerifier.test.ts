import * as fs from "fs";
import * as path from "path";
import { workbookReader } from "@/features/importer/reader/workbookReader";
import { spectoraImporter } from "@/features/importer";
import { preservationVerifier } from "@/features/importer/audit/preservationVerifier";

/**
 * Preservation Verification Test Suite
 * Tests:
 * 1. Source sections are 100% represented in imported template
 * 2. Source items are 100% represented under correct parent sections
 * 3. Source comments are 100% represented under correct items
 * 4. Order is preserved sequentially
 * 5. Comment text & HTML formatting survive
 * 6. Warnings exist for non-standard or unsupported content
 */
export async function runPreservationVerifierTests(): Promise<{
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

  const fixturePath = path.resolve(process.cwd(), "fixtures/Residential Template-2026-09-14.xls");
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found at: ${fixturePath}`);
  }

  const buffer = fs.readFileSync(fixturePath);

  // 1. Read raw sheet directly
  const rawSheet = workbookReader.read(buffer);
  assert(rawSheet.rows.length === 392, `Raw sheet contains exactly 392 data rows (got ${rawSheet.rows.length})`);

  // 2. Run importer pipeline
  const importResult = spectoraImporter.importWorkbook(buffer, {
    filename: "Residential Template-2026-09-14.xls",
    templateName: "Residential Baseline Inspection",
  });
  assert(importResult.success === true, "Importer execution succeeded");

  // 3. Execute Preservation Verifier comparison
  const report = preservationVerifier.verifyPreservation(
    rawSheet,
    importResult.template,
    importResult.warnings
  );

  // Assert Ground Truth Preservation
  assert(report.isFullyPreserved === true, "Preservation verifier confirms 100% full customer content preservation");
  assert(report.discrepancies.length === 0, `Zero discrepancies between source and imported template (found ${report.discrepancies.length})`);

  // Assert Factual Counts Match
  assert(report.metrics.sourceSectionsCount === 13, "Source contains 13 sections");
  assert(report.metrics.importedSectionsCount === 13, "Imported contains exactly 13 sections");
  assert(report.metrics.sourceItemsCount === 69, "Source contains 69 items");
  assert(report.metrics.importedItemsCount === 69, "Imported contains exactly 69 items");
  assert(report.metrics.sourceCommentsCount === 392, "Source contains 392 comments");
  assert(report.metrics.importedCommentsCount === 392, "Imported contains exactly 392 comments");

  // Assert Guarantees
  assert(report.verifiedGuarantees.length >= 3, "Verified guarantees recorded");

  return {
    passed: true,
    totalChecks,
    summary,
  };
}
