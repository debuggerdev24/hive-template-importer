const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Primary fixture file path
const targetFile = path.resolve(__dirname, "../fixtures/Residential Template-2026-09-14.xls");
const buffer = fs.readFileSync(targetFile);

// Helper to extract ZIP entries
function readZipEntries(buf) {
  const entries = {};
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) === 0x04034b50) {
      const compMethod = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const fnLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const fileName = buf.subarray(i + 30, i + 30 + fnLen).toString("utf8");
      const dataStart = i + 30 + fnLen + extraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      let data;
      try {
        if (compMethod === 0) {
          data = compData;
        } else if (compMethod === 8) {
          data = zlib.inflateRawSync(compData);
        }
      } catch (e) {}

      if (data) {
        entries[fileName] = data.toString("utf8");
      }
      i = dataStart + compSize;
    } else {
      i++;
    }
  }
  return entries;
}

const entries = readZipEntries(buffer);
const isZip = Object.keys(entries).length > 0;

if (!isZip) {
  console.log("Not a zip file. Checking text/HTML...");
  console.log(buffer.subarray(0, 500).toString("utf8"));
  process.exit(0);
}

// 1. Workbook format
const workbookFormat = "OpenXML Spreadsheet (XLSX format packaged as PKZip container with .xls filename extension)";

// 2. Sheet names
let sheetNames = [];
if (entries["xl/workbook.xml"]) {
  const wbXml = entries["xl/workbook.xml"];
  const sheetMatches = wbXml.matchAll(/<sheet[^>]*name="([^"]+)"/g);
  for (const m of sheetMatches) {
    sheetNames.push(m[1]);
  }
}

// Shared strings
let sharedStrings = [];
if (entries["xl/sharedStrings.xml"]) {
  const ssXml = entries["xl/sharedStrings.xml"];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(ssXml)) !== null) {
    const siContent = match[1];
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    let text = "";
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += tMatch[1];
    }
    sharedStrings.push(text);
  }
}

// Sheet rows
let rows = [];
if (entries["xl/worksheets/sheet1.xml"]) {
  const sheetXml = entries["xl/worksheets/sheet1.xml"];
  const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10);
    const rowContent = rowMatch[2];
    const cellRegex = /<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
    let cellMatch;
    const cells = {};
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetter = cellMatch[1];
      const type = cellMatch[2];
      const rawVal = cellMatch[3] !== undefined ? cellMatch[3] : "";
      let val = rawVal;
      if (type === "s") {
        val = sharedStrings[parseInt(rawVal, 10)] || "";
      }
      cells[colLetter] = val;
    }
    rows.push({ rowNum, cells });
  }
}

// Helper to convert column letter to index (A=0, B=1, ... Z=25, AA=26)
function colLetterToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

const headerRowObj = rows[0] ? rows[0].cells : {};
const colMap = {}; // index -> name
const colLetterToName = {};
for (const [colLetter, val] of Object.entries(headerRowObj)) {
  colLetterToName[colLetter] = val;
  colMap[colLetterToIndex(colLetter)] = val;
}

const exactColumnNames = Object.values(colLetterToName);
const dataRows = rows.slice(1);

// Statistics
const colPopulationStats = {};
exactColumnNames.forEach((name) => {
  colPopulationStats[name] = 0;
});

const answerTypeSamples = new Set();
const multipleChoiceSamples = [];
const htmlSamples = [];
const malformedRows = [];
const sectionsFound = new Set();
const itemsFound = new Set();

dataRows.forEach((r, idx) => {
  const rowData = {};
  for (const [colLetter, colName] of Object.entries(colLetterToName)) {
    const val = r.cells[colLetter] !== undefined ? r.cells[colLetter] : "";
    rowData[colName] = val;
    if (val !== "") {
      colPopulationStats[colName]++;
    }
  }

  const secName = rowData["Section Name"] || "";
  const itemName = rowData["Item Name"] || "";
  const commentText = rowData["Comment Text"] || "";
  const answerType = rowData["Answer Type"] || "";
  const mcOptions = rowData["Multiple Choice Options"] || "";

  if (secName) sectionsFound.add(secName);
  if (itemName) itemsFound.add(`${secName} > ${itemName}`);
  if (answerType) answerTypeSamples.add(answerType);
  if (mcOptions && multipleChoiceSamples.length < 5) multipleChoiceSamples.push(mcOptions);
  if (commentText.includes("<") && commentText.includes(">") && htmlSamples.length < 5) {
    htmlSamples.push(commentText);
  }

  // Check for malformed rows (e.g. comment text without item name or section name)
  if (!secName && !itemName && !commentText) {
    malformedRows.push({ rowNum: r.rowNum, reason: "Completely empty row" });
  } else if (commentText && !itemName) {
    malformedRows.push({ rowNum: r.rowNum, reason: "Comment text present without Item Name" });
  }
});

const alwaysPopulatedCols = [];
const optionalCols = [];
for (const [col, count] of Object.entries(colPopulationStats)) {
  if (count === dataRows.length) {
    alwaysPopulatedCols.push(col);
  } else {
    optionalCols.push({ col, populatedCount: count, total: dataRows.length });
  }
}

const result = {
  "1_workbookFormat": workbookFormat,
  "2_sheetNames": sheetNames,
  "3_rowCount": dataRows.length + 1,
  "4_columnCount": exactColumnNames.length,
  "5_exactColumnNames": exactColumnNames,
  "6_alwaysPopulatedColumns": alwaysPopulatedCols,
  "7_optionalColumns": optionalCols,
  "8_sectionsCount": sectionsFound.size,
  "9_itemsCount": itemsFound.size,
  "10_dataRowsCount": dataRows.length,
  "11_answerTypes": Array.from(answerTypeSamples),
  "12_multipleChoiceSamples": multipleChoiceSamples,
  "13_htmlSamples": htmlSamples,
  "14_malformedRows": malformedRows,
  "15_colLetterToName": colLetterToName,
  "16_firstTwoDataRows": dataRows.slice(0, 2).map((r) => {
    const res = {};
    for (const [colLetter, name] of Object.entries(colLetterToName)) {
      res[name] = r.cells[colLetter] || "";
    }
    return res;
  }),
};

fs.writeFileSync(
  path.resolve(__dirname, "../fixtures/analysis_summary.json"),
  JSON.stringify(result, null, 2),
  "utf8"
);

console.log("=== WORKBOOK INSPECTION SUMMARY ===");
console.log("Format:", workbookFormat);
console.log("Sheets:", sheetNames);
console.log("Total Rows (incl header):", dataRows.length + 1);
console.log("Total Columns:", exactColumnNames.length);
console.log("Columns:", exactColumnNames);
console.log("Unique Sections:", sectionsFound.size);
console.log("Unique Items:", itemsFound.size);
console.log("Answer Types Found:", Array.from(answerTypeSamples));
console.log("Malformed rows detected:", malformedRows.length);
console.log("Analysis saved to fixtures/analysis_summary.json");
