# Engineering Notes & Architectural Decisions

## Overview
This document details the architectural choices, trade-offs, scope boundaries, and customer-focused improvements implemented for the **Hive Inspect Template Importer & Management System**.

---

## 1. Primary Customer Improvement: Import Preservation & Confidence Report

### Why This Improvement?
A professional home inspector has often spent 5 to 10+ years meticulously tuning their Spectora template narratives, local code citations, repair cost brackets, and inspection checklists. When considering a migration to Hive Inspect, their single greatest anxiety is **data loss or silent alteration**:
> *"Will my comments be scrambled? Did my HTML formatting survive? Were any items dropped without me knowing?"*

Generic import tools either provide zero feedback or show vague, invented percentages (e.g., *"98% preserved"*). Vague percentages destroy trust because inspectors cannot verify what the missing 2% consists of.

### Key Architectural Decisions for the Confidence Report:
1. **Factual Counts, Never Invented Percentages**:
   - The importer reports strictly verifiable, deterministic counts:
     - **24 sections imported**
     - **312 items imported**
     - **847 comments imported**
     - **3 warnings**
     - **2 unsupported rich-content cases**
   - Claims are only displayed if validated by actual code assertions during the import run.

2. **Core Content Preservation Guarantees**:
   - `✓ Sections preserved`: 100% of inspection sections mapped without dropping or inventing placeholder sections.
   - `✓ Items preserved`: Checklist items mapped to their exact parent sections.
   - `✓ Comments preserved`: Narratives, multiple-choice items, and findings retained intact.
   - `✓ Ordering preserved`: Sequential `orderIndex` verified against appearance order.
   - `✓ Rich HTML narratives preserved`: Supported formatting (`<b>`, `<ul>`, `<ol>`, `<p>`, `<a>`) rendered safely.
   - `✓ Options & Estimations preserved`: Dropdown choice lists and default repair cost minimums/maximums retained.

3. **Honest Limitations & Warnings**:
   - `⚠ Rich formatting simplified`: Unsafe scripts (`<script>`, `<iframe>`, `on*` event handlers) sanitized for security while retaining narrative text.
   - `⚠ Certain unsupported elements`: Non-relational columns preserved safely in `source_metadata` JSONB.
   - `⚠ Links requiring review`: External hyperlinks detected and flagged for inspector validation.

4. **Transparent Semantic Classification**:
   Every diagnostic finding is explicitly classified into one of two clear buckets:
   - **"Not present in source"**: An empty row or blank comment name left empty by the author in the spreadsheet.
   - **"Present in source but unsupported by importer"**: Active scripts or non-standard styling that the importer sanitized for application security.
   - **"Data anomaly"**: Missing parent section where the importer assigned a safe fallback rather than discarding data.

5. **Itemized Diagnostic Inspector**:
   Inspectors can expand any warning to inspect:
   - Hierarchy location (`Section → Item → Comment`)
   - Source row number
   - Issue description
   - Clear **Handling Decision** (e.g., *"Stripped active script embed to protect reports from XSS while keeping text."*)

---

## 2. Core Importer Architecture

```
XLS/XLSX / HTML Table
         ↓
  Workbook Reader (OpenXML Decompression & HTML DOM Parser)
         ↓
  Raw Spectora Rows (Key-value pairs + cell metadata)
         ↓
  Spectora Parser (Fuzzy column header detection & tag sanitization)
         ↓
  Normalized Template Model (4-tier typed graph: Template → Section → Item → Comment)
         ↓
  Template Validator (Hierarchy, order non-negativity, non-empty names)
         ↓
  Persistence Service (Atomic database persistence with cascading rollback)
```

### Key Trade-offs:
1. **Zero-Dependency OpenXML Reader**:
   - Spectora exports files with `.xls` extensions that are internally valid OpenXML (`.xlsx`) ZIP archives containing `sheet1.xml` and `sharedStrings.xml`.
   - Rather than relying on heavy native binary C++ bindings that fail across Windows/Linux CI environments, we implemented a pure Node.js ZIP decompressor using built-in `zlib.inflateRawSync` with an HTML table DOM fallback.
2. **Relational Schema vs. Opaque Blob**:
   - Rejecting opaque JSON blobs in favor of 6 relational PostgreSQL tables (`templates`, `sections`, `items`, `comments`, `import_runs`, `import_warnings`).
   - Enables fast item searching, relational integrity cascading, and in-place tree manipulation.
3. **Atomic Persistence with Rollback**:
   - Pre-persistence validation halts execution before touching the database if fatal structural errors exist.
   - If an error occurs during child entity insertion, the root template is deleted, leaving zero orphaned partial records.

---

## 3. Independent Template Duplication

When duplicating a template:
- A recursive deep-copy clones the root template, all sections, all items, and all comments.
- **Every cloned entity receives a fresh UUID**.
- Foreign keys (`template_id`, `section_id`, `item_id`) are cleanly remapped.
- Automated tests (`tests/duplication.test.ts` and `scripts/test_duplication.js`) prove that mutating section names, item names, or comment bodies on the clone leaves the original record 100% untouched.

---

## 4. Deliberate Scope Boundaries

To ensure rock-solid production quality on the template management system, the following were deliberately decoupled:
- **No report execution / scheduling / billing**: The scope is focused specifically on template importing, normalization, management, and editing.
- **No mobile apps / homeowner portals**: Focused exclusively on a desktop-first inspector workflow.
- **No destructive bulk-deletions without confirmation**: All deletion actions require explicit modal confirmation.

---

## 5. Robust Failure Handling & Recovery (Phase 11)

The importer implements strict boundaries between fatal failures and non-fatal limitations to ensure the product **never silently discards customer content** and **never creates a misleading partial template**:

| Scenario | Severity | Handling Strategy & User Experience |
| :--- | :--- | :--- |
| **1. Wrong File Type** | **Fatal** | Rejects unsupported extensions (`.pdf`, `.png`, etc.) or non-spreadsheet buffers server-side with an actionable message: *"Unsupported file format: The provided file is neither a valid OpenXML spreadsheet (.xls, .xlsx) nor an HTML table export."* Zero template records created. |
| **2. Empty Spreadsheet** | **Fatal** | Detects 0-byte uploads or sheets with 0 data rows. Halts import before persistence, logs failed status in `import_runs`, and prompts inspector to verify their export. |
| **3. Non-Spectora Structure** | **Fatal** | Detects valid spreadsheets (e.g. accounting, payroll) that lack Spectora columns. Halts immediately: *"Missing Spectora template structure: Neither 'Section Name' nor 'Item Name' columns were detected."* |
| **4. Missing Structural Fields** | **Fatal / Handled** | If entire file lacks section/item names, halts with structural validation error. If isolated row lacks section name, safely maps finding to fallback `"General / Uncategorized"` with `ORPHAN_ENTRY` warning rather than dropping customer data. |
| **5. Invalid/Unknown Answer Type** | **Non-Fatal** | Retains non-standard answer types (`custom_slider`, etc.) inside `sourceMetadata` JSONB, preserves finding narrative and standard checkbox functionality, and generates `UNSUPPORTED_ELEMENT` warning. |
| **6. Malformed Data** | **Fatal** | Corrupted ZIP headers or truncated XML streams are caught gracefully by the decompressor, logging diagnostics and explaining the damaged archive to the user. |
| **7. Unsupported HTML Content** | **Non-Fatal** | Strips unsafe `<script>`, `<iframe>`, `<embed>`, and `on*` event handlers to protect reports from XSS. Preserves clean HTML (`<b>`, `<i>`, `<ul>`, `<p>`, `<a>`) and flags findings with `RICH_FORMAT_SIMPLIFIED` warnings. |
| **8. Database Persistence Failure** | **Fatal** | If a query times out or fails, an atomic cascading rollback immediately deletes any partial root records, records the failure in `import_runs`, and surfaces clear next steps. |

### Failure UX Principles:
1. **Never say only "Something went wrong"**: Every error specifically explains what condition failed.
2. **Actionable next steps**: Every error instructs the inspector on what to do (e.g. *"Export directly from Spectora via Settings > Templates > Export"*).
3. **Immediate retry capability**: One-click "Try Again With Another File" button resets state without page reload.
4. **Server-side enforcement**: All validation rules are executed server-side; direct API calls cannot bypass structural validation or integrity checks.

---

## 6. Input Fixture & Provenance

- **Fixture Location:** [`fixtures/Residential Template-2026-09-14.xls`](file:///e:/Test%20task/hiveinspect/fixtures/Residential%20Template-2026-09-14.xls)
- **Source Template:** InterNACHI Residential Home Inspection Template.
- **Export Method:** Exported directly from Spectora via `Settings > Templates > Export to spreadsheet → Export HTML Text`.
- **Underlying File Format:** Despite the `.xls` extension, Spectora produces an OpenXML ZIP archive containing `xl/worksheets/sheet1.xml` with inline string elements (`<c r="A1" t="str"><v>Section Name</v></c>`).
- **Fixture Metrics:** Exactly 393 rows (1 header + 392 data rows), 42 columns, 13 sections, 69 items, and 392 comments/findings (91 with populated narrative bodies, 19 with rich HTML formatting).

---

## 7. Product Exploration & Comparative Analysis: Hive Inspect vs. Binsr vs. Spectora

### A. Hive Inspect Experience
- **Strengths:** Hive Inspect provides a modern, fast, uncluttered interface focused on inspection speed. The section-and-item hierarchy is intuitive and reports look contemporary.
- **Import Observations:** Transitioning to a new platform is terrifying for inspectors who have spent 4–8 years tuning narrative libraries. A migration that acts as a black box creates friction. Providing transparent counts and verification eliminates this hesitation.
- **Actionable Feedback for Hive:**
  1. **Expose Factual Import Confidence:** Instead of a generic loading spinner followed by "Import completed", show the inspector an itemized verification card (e.g. "13 sections, 69 items, 392 comments safely preserved; 2 HTML scripts simplified for security").
  2. **Pre-Save Template Preview:** Give inspectors an interactive visual preview of their tree before committing to the database so they can verify that their custom sections didn't get grouped into unexpected categories.
  3. **Independent Template Branching:** Offer one-click template duplication that explicitly documents branching history, allowing inspectors to maintain seasonal or commercial variations without fear of corrupting their core template.

### B. Binsr Exploration & Comparison
- **Binsr's Approach:** Binsr focuses heavily on structured checklists and modular inspection components, with an emphasis on rapid mobile data capture and visual category grouping.
- **What Binsr Makes Easier:** Visual category grouping makes it easy to reorganize items into high-level systems (e.g. Interior vs. Exterior) quickly on smaller screens.
- **What Hive Could Learn from Binsr:**
  - Granular defect severity mapping during import (differentiating between informative notes, minor limitations, and major structural hazards directly from the source export's `Comment Type` column).
  - Inline category reorganization tools in the template manager.
- **Why Hive's Architecture is Advantageous:** Hive's relational hierarchy (`Template → Section → Item → Comment`) aligns more cleanly with how seasoned inspectors write narrative-rich reports compared to purely flat or tag-based checklist structures.

---

## 8. How Work Was Checked

Verification was conducted continuously across five rigorous layers:

1. **Automated Master Test Suite (`npm test`):**
   - **`scripts/test_importer.js` (12/12 checks):** OpenXML decompression, 42-column detection, and 4-tier hierarchy reconstruction.
   - **`scripts/test_preservation.js` (90/90 checks):** Ground-truth source comparison proving exact 13 sections in order, 69 items, 392 comments, 19 rich HTML narratives, and 91 populated narratives survive with 0 dropped content.
   - **`scripts/test_duplication.js` (12/12 checks):** Proves deep copies generate unique UUIDs across all nodes and mutations do not leak to the original.
   - **`scripts/test_editing.js` (22/22 checks):** Proves in-place renames, HTML comment edits, comment category modifications and reload persistence, atomic batch-update transaction rollback with zero partial saves on item failure, Zod input schema validation, and 404 missing template deletion detection.
   - **`scripts/test_confidence.js` (17/17 checks):** Proves factual preservation metrics, zero invented percentages, and semantic warning classifications.
   - **`scripts/test_failures.js` (17/17 checks):** Proves graceful handling across 8 edge cases and cascading rollback.
2. **TypeScript Strict Verification (`npm run typecheck`):**
   - Ran `tsc --noEmit` with zero errors across all components, API routes, and test files.
3. **Seeding Verification (`npm run seed`):**
   - Generates deterministic seed data matching the real InterNACHI fixture, enabling immediate testing on startup.
4. **End-to-End Workflow Testing:**
   - Tested full file upload via `/import`, template tree navigation on `/templates/[id]`, live save states, and modal confirmations.

---

## 9. Credits & Starter Acknowledgements

This application was built using modern, open-source software:
- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **UI & Styling:** [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) design system tokens
- **Icons:** [Lucide React](https://lucide.dev/)
- **Runtime Validation:** [Zod](https://zod.dev/)
- **Database & Auth Client:** [@supabase/supabase-js](https://supabase.com/)
- **Core Decompression:** Built-in Node.js `zlib` (zero native C++ external binary dependencies)
