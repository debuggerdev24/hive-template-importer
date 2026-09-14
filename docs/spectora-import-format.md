# Spectora HTML-Text Spreadsheet Export Specification & Field Mapping

This document specifies the exact format of Spectora's **"Export to spreadsheet → Export HTML Text"** (`.xls` / `.xlsx` OpenXML container) based on empirical analysis of the workbook fixture (`fixtures/Residential Template-2026-09-14.xls`).

---

## 1. Physical Workbook Format & Structural Overview

* **Container Format:** OpenXML Spreadsheet (ZIP archive containing `[Content_Types].xml`, `xl/workbook.xml`, `xl/worksheets/sheet1.xml`, and `xl/sharedStrings.xml`), exported with a `.xls` file extension.
* **Sheets:** Single sheet named `Sheet1`.
* **Dimensions:**
  * **Header row:** Row 1 (contains 42 distinct column headers).
  * **Data rows:** 392 rows (393 total rows in sheet).
  * **Total unique Sections:** 13
  * **Total unique Items:** 69
* **Hierarchy Representation:**
  * Hierarchy is encoded row-by-row in a flattened table format.
  * Every row carries its parent `Section Name` and parent `Item Name`.
  * The hierarchy relationship is:
    $$\text{Section} \longrightarrow \text{Item} \longrightarrow \text{Comment / Finding}$$
  * A section boundary occurs when `Section Name` changes.
  * An item boundary occurs when `Item Name` changes within a section.
  * Rows with the same `(Section Name, Item Name)` represent sequential checklist items or comments belonging to that item.

---

## 2. Exhaustive Column Mapping (42 Columns)

| # | Source Column Name | Internal Entity & Field | Transformation / Type | Preservation Behavior | Unsupported / Missing Handling |
|:---|:---|:---|:---|:---|:---|
| 1 | `Section Name` | `Section.name` | Trimmed `string` | Preserved as primary section identifier. Order established by first appearance. | If empty: Logged as `MISSING_SECTION_NAME` warning and assigned to `"General / Uncategorized"`. |
| 2 | `Item Name` | `Item.name` | Trimmed `string` | Preserved as primary item identifier under parent section. | If empty: Logged as `MISSING_ITEM_NAME` warning and assigned to fallback `"General"`. |
| 3 | `Comment Name` | `Comment.commentName` | Trimmed `string` (nullable) | Preserved as finding/checkbox title. | Empty in 11 rows: Preserved as `null`. Does not fail import. |
| 4 | `Comment Text` | `Comment.commentText` | HTML `string` | Full HTML formatting (`<p>`, `<b>`, `<ul>`, `<a>`) preserved intact. | Empty in 301 checklist rows: Stored as empty string `""` (many checklist items only have `Comment Name` and options). |
| 5 | `Comment Type (info, limit, defect)` | `Comment.commentType` | Normalized enum: `'info' \| 'limit' \| 'defect'` | Preserved in comment record. | Populated in 100% of rows. Fallback to `'info'` if unexpected string encountered. |
| 6 | `Category (-1: Low, 0: Med, 1: High)` | `Comment.category` | String/Number: `"-1"`, `"0"`, `"1"` | Maps to severity rating: Low (`-1`), Medium (`0`), High (`1`). | Optional (empty in 90 rows): Stored as `null`. |
| 7 | `Multiple Choice Options (comma-separated)` | `Comment.multipleChoiceOptions` | Split by comma: `string[]` | Preserved as array of selectable options. | Stored as empty array `[]` when empty. |
| 8 | `Unit Type Options (numeric answers only, comma-separated)` | `Comment.unitTypeOptions` | Split by comma: `string[]` | Preserved as array of unit descriptors. | Stored as empty array `[]` when empty. |
| 9 | `Recommendation (from list)` | `Comment.recommendation` | Trimmed `string` (nullable) | Preserved in structured comment record. | Stored as `null` when empty. |
| 10 | `Order (w/i item)` | `Comment.orderIndex` | `parseInt(val, 10)` | Strictly preserves sequential position within the parent item. | If not numeric: Derived sequentially from row appearance. |
| 11 | `Answer Type (boolean, checkbox, date, number, range, text)` | `Comment.answerType` | Normalized string: `'checkbox'`, `'text'`, etc. | Preserved in comment record. | Populated across rows. |
| 12 | `Default Value` | `Comment.defaultValue` | Trimmed `string` (nullable) | Preserved in comment record. | Stored as `null` when empty. |
| 13 | `Default Value 2 (for "range" types)` | `Comment.defaultValue2` | Trimmed `string` (nullable) | Preserved in comment record. | Stored as `null` when empty. |
| 14 | `Default Unit Type (for "number" and "range" types)` | `Comment.defaultUnitType` | Trimmed `string` (nullable) | Preserved in comment record. | Stored as `null` when empty. |
| 15 | `Default Location` | `Comment.defaultLocation` | Trimmed `string` (nullable) | Preserved in comment record. | Stored as `null` when empty. |
| 16 | `Default Estimate Min` | `Comment.defaultEstimateMin` | `Number(val)` (nullable) | Preserved in comment record. | Stored as `null` when empty or non-numeric. |
| 17 | `Default Estimate Max` | `Comment.defaultEstimateMax` | `Number(val)` (nullable) | Preserved in comment record. | Stored as `null` when empty or non-numeric. |
| 18 | `Locked` | `Comment.locked` | Boolean: `'true'/'1' -> true` | Preserved in comment record. | Defaults to `false` when empty. |
| 19 | `Simple Format` | `Comment.simpleFormat` | Boolean: `'true'/'1' -> true` | Preserved in comment record. | Defaults to `false` when empty. |
| 20 | `Disable Photos` | `Comment.disablePhotos` | Boolean: `'true'/'1' -> true` | Preserved in comment record. | Defaults to `false` when empty. |
| 21 | `Uses` | `Comment.sourceMetadata.uses` | Integer | Preserved in `sourceMetadata`. | Stored in metadata. |
| 22–41 | `Default Photo 1..10` & `Caption 1..10` | `Comment.defaultPhotosAndCaptions` | Structured array of `{ url, caption }` | Preserved in structured JSON array. | Blank columns are omitted from the array. |
| 42 | `Last Modified` | `Comment.sourceLastModified` | ISO date string | Preserved as audit timestamp. | Stored as `null` if unparseable. |

---

## 3. Preservation vs Unsupported Policy

### A. Fields Fully Supported & Editable in Initial Model
* `Section Name`
* `Item Name`
* `Comment Name`
* `Comment Text` (with HTML preserved)
* `Order (w/i item)`
* `Comment Type` (info, limit, defect)
* `Category` (severity rating)
* `Recommendation`

### B. Fields Preserved Structurally (Available for Downstream Extensions)
* `Answer Type`
* `Multiple Choice Options`
* `Unit Type Options`
* `Default Values (1 & 2)`
* `Default Unit Type`
* `Default Location`
* `Default Estimates (Min & Max)`
* `Locked`, `Simple Format`, `Disable Photos`
* `Default Photos and Captions`

### C. Source-Missing vs Importer-Unsupported
* **Source-Missing (Benign):** A field that Spectora left empty in the export (e.g. `Default Value 2` for non-range items). Stored cleanly as `null`/`[]` without generating warnings.
* **Importer-Unsupported / Anomaly (Warning Generated):**
  * Malformed rows (e.g., non-numeric order index).
  * Rows containing unassigned content with missing `Section Name` or `Item Name`.
  * Embedded unsafe scripts (`<script>`, `<iframe>`) stripped for security.
  * Every warning logs row number, column name, issue type, and raw snippet.
