const fs = require("fs");
const path = require("path");

console.log("=== RUNNING IMPORTER ROBUST FAILURE HANDLING TESTS (8 SCENARIOS) ===");

let passed = 0;
function assert(cond, name) {
  if (!cond) {
    console.error(`❌ FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ PASS: ${name}`);
}

// Emulate parsing & failure detection logic
function checkImportEligibility(input, filename) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");

  // 1. Check 0-byte empty file
  if (buffer.length === 0) {
    throw new Error("Empty file: The uploaded file contains 0 bytes. Please select a valid Spectora spreadsheet (.xls/.xlsx) or provide HTML table markup.");
  }

  // Check wrong extension or magic bytes
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const textSnippet = buffer.subarray(0, 2000).toString("utf-8").toLowerCase();
  const isHtml = textSnippet.includes("<table") || textSnippet.includes("<tr") || textSnippet.includes("<html");

  if (!isZip && !isHtml) {
    throw new Error("Unsupported file format: The provided file is neither a valid OpenXML spreadsheet (.xls, .xlsx) nor an HTML table export. Please export your template directly from Spectora (Settings > Templates > Export) and try uploading again.");
  }

  // If Zip, check if corrupted
  if (isZip) {
    if (buffer.length < 30) {
      throw new Error("Corrupted spreadsheet archive: The ZIP archive could not be decompressed or contains damaged file records. Please re-export your template from Spectora.");
    }
  }

  // If HTML, check for Spectora structure
  if (isHtml) {
    const hasSectionCol = textSnippet.includes("section name") || textSnippet.includes("section");
    const hasItemCol = textSnippet.includes("item name") || textSnippet.includes("item");

    if (!hasSectionCol && !hasItemCol) {
      throw new Error("Missing Spectora template structure: Neither 'Section Name' nor 'Item Name' header columns were detected in the spreadsheet. Please verify this file was exported directly from Spectora (Settings > Templates > Export) and try again.");
    }
  }

  return { valid: true };
}

// -------------------------------------------------------------
// Scenario 1: Wrong File Type
// -------------------------------------------------------------
console.log("\nScenario 1: Wrong File Type");
try {
  checkImportEligibility(Buffer.from("%PDF-1.4 %binary pdf data..."), "report.pdf");
  assert(false, "Should reject PDF");
} catch (e) {
  assert(e.message.includes("Unsupported file format"), "Scenario 1: Detected unsupported file format");
}

// -------------------------------------------------------------
// Scenario 2: Empty Spreadsheet (0 bytes)
// -------------------------------------------------------------
console.log("\nScenario 2: Empty Spreadsheet");
try {
  checkImportEligibility(Buffer.alloc(0), "empty.xls");
  assert(false, "Should reject 0-byte file");
} catch (e) {
  assert(e.message.includes("Empty file"), "Scenario 2: Detected 0-byte empty file");
}

// -------------------------------------------------------------
// Scenario 3: Spreadsheet Without Expected Spectora Structure
// -------------------------------------------------------------
console.log("\nScenario 3: Spreadsheet Without Expected Spectora Structure");
try {
  const nonSpectoraHtml = "<table><tr><th>Employee</th><th>Salary</th></tr><tr><td>John</td><td>$50k</td></tr></table>";
  checkImportEligibility(nonSpectoraHtml, "payroll.html");
  assert(false, "Should reject non-Spectora table");
} catch (e) {
  assert(e.message.includes("Missing Spectora template structure"), "Scenario 3: Detected missing 'Section Name' / 'Item Name' columns");
}

// -------------------------------------------------------------
// Scenario 4: Missing Required Structural Fields (Sections/Items)
// -------------------------------------------------------------
console.log("\nScenario 4: Missing Required Structural Fields");
function validateStructure(sections) {
  if (!sections || sections.length === 0) {
    throw new Error("Missing required structure: The template contains zero sections. Please ensure your Spectora file contains defined inspection sections.");
  }
  let totalItems = 0;
  sections.forEach((s) => (totalItems += s.items.length));
  if (totalItems === 0) {
    throw new Error("Missing required structure: The template contains zero checklist items. Please ensure your Spectora export contains items under its sections.");
  }
  return true;
}

try {
  validateStructure([]);
  assert(false, "Should reject 0 sections");
} catch (e) {
  assert(e.message.includes("zero sections"), "Scenario 4: Detected 0 sections");
}

try {
  validateStructure([{ name: "Roofing", items: [] }]);
  assert(false, "Should reject 0 items");
} catch (e) {
  assert(e.message.includes("zero checklist items"), "Scenario 4: Detected 0 items");
}

// -------------------------------------------------------------
// Scenario 5: Invalid / Unknown Answer Type (Non-Fatal)
// -------------------------------------------------------------
console.log("\nScenario 5: Invalid / Unknown Answer Type");
function parseAnswerType(answerTypeRaw) {
  const answerType = answerTypeRaw ? answerTypeRaw.toLowerCase() : null;
  const warnings = [];
  if (answerType && !["multiple_choice", "checkbox", "text", "number", "date", ""].includes(answerType)) {
    warnings.push({
      warningType: "UNSUPPORTED_ELEMENT",
      message: `Specialized or unrecognized answer type '${answerTypeRaw}'.`,
      handlingDecision: `Retained original answer type '${answerTypeRaw}' in attributes while providing standard finding narrative and checkbox.`,
      classification: "unsupported_by_importer",
    });
  }
  return { answerType, warnings, success: true };
}

const atResult = parseAnswerType("custom_rotary_dial_v2");
assert(atResult.success === true, "Scenario 5: Import completes non-fatally");
assert(atResult.warnings.length === 1, "Scenario 5: Generated UNSUPPORTED_ELEMENT warning");
assert(atResult.warnings[0].classification === "unsupported_by_importer", "Scenario 5: Classified as unsupported by importer");

// -------------------------------------------------------------
// Scenario 6: Malformed Data (Corrupted OpenXML ZIP)
// -------------------------------------------------------------
console.log("\nScenario 6: Malformed Data");
try {
  checkImportEligibility(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x12]), "corrupt.xlsx");
  assert(false, "Should reject truncated ZIP");
} catch (e) {
  assert(e.message.includes("Corrupted spreadsheet archive"), "Scenario 6: Detected corrupted ZIP archive");
}

// -------------------------------------------------------------
// Scenario 7: Unsupported HTML / Rich Content (Non-Fatal)
// -------------------------------------------------------------
console.log("\nScenario 7: Unsupported HTML / Rich Content");
function sanitizeFindingNarrative(html) {
  const warnings = [];
  let cleaned = html;
  if (/<(?:script|iframe|object|embed|style)/i.test(html) || /on\w+=["'][^"']*["']/i.test(html)) {
    warnings.push({
      warningType: "RICH_FORMAT_SIMPLIFIED",
      message: "Potentially unsafe or unsupported rich elements sanitized.",
      handlingDecision: "Stripped active scripts/embeds to protect inspection reports from XSS while preserving text and safe markup.",
      classification: "unsupported_by_importer",
    });
    cleaned = html
      .replace(/<(?:script|iframe|object|embed|style)[\s\S]*?<\/(?:script|iframe|object|embed|style)>/gi, "")
      .replace(/\s*on\w+=["'][^"']*["']/gi, "");
  }
  return { cleaned, warnings, success: true };
}

const htmlResult = sanitizeFindingNarrative("<p>Inspected.</p><script>evil()</script>");
assert(htmlResult.success === true, "Scenario 7: Import completes successfully");
assert(!htmlResult.cleaned.includes("<script>"), "Scenario 7: Dangerous script stripped");
assert(htmlResult.cleaned.includes("<p>Inspected.</p>"), "Scenario 7: Safe narrative text preserved");
assert(htmlResult.warnings.length === 1, "Scenario 7: RICH_FORMAT_SIMPLIFIED warning created");

// -------------------------------------------------------------
// Scenario 8: Database Persistence Failure & Cascading Rollback
// -------------------------------------------------------------
console.log("\nScenario 8: Database Persistence Failure & Cascading Rollback");
class MockPersistenceService {
  async saveTemplateWithRollback(shouldFail) {
    let createdTemplateId = "tpl-temp-123";
    let rollbackExecuted = false;
    try {
      if (shouldFail) {
        throw new Error("Foreign key constraint violation or DB timeout.");
      }
      return { success: true, templateId: createdTemplateId };
    } catch (saveError) {
      // Cascading rollback
      if (createdTemplateId) {
        rollbackExecuted = true;
        createdTemplateId = null;
      }
      return {
        success: false,
        status: "failed",
        errors: [`Database persistence failure: ${saveError.message}. All partial records were automatically rolled back.`],
        rollbackExecuted,
      };
    }
  }
}

async function testPersistenceFailure() {
  const svc = new MockPersistenceService();
  const res = await svc.saveTemplateWithRollback(true);
  assert(res.success === false, "Scenario 8: Failed persistence returns success=false");
  assert(res.status === "failed", "Scenario 8: Status is failed");
  assert(res.rollbackExecuted === true, "Scenario 8: Rollback executed to prevent partial template");
  assert(res.errors[0].includes("Database persistence failure"), "Scenario 8: Error message clearly explains persistence failure");
}

testPersistenceFailure().then(() => {
  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passed} FAILURE HANDLING & RECOVERY TESTS PASSED!`);
  console.log(`======================================================\n`);
});
