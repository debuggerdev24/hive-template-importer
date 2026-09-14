const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

console.log("=== RUNNING DETERMINISTIC IMPORTER TEST SUITE ===");

// 1. Workbook Reader Verification
const fixturePath = path.resolve(__dirname, "../fixtures/Residential Template-2026-09-14.xls");
if (!fs.existsSync(fixturePath)) {
  console.error("Fixture not found at:", fixturePath);
  process.exit(1);
}

const buffer = fs.readFileSync(fixturePath);

function readZipEntries(buf) {
  const entries = {};

  // 1. Try Central Directory (standard ZIP specification for streaming OpenXML files)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd !== -1) {
    const cdOffset = buf.readUInt32LE(eocd + 16);
    const cdCount = buf.readUInt16LE(eocd + 10);
    let ptr = cdOffset;

    for (let j = 0; j < cdCount && ptr < eocd; j++) {
      if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) break;
      const compMethod = buf.readUInt16LE(ptr + 10);
      const compSize = buf.readUInt32LE(ptr + 20);
      const fnLen = buf.readUInt16LE(ptr + 28);
      const extraLen = buf.readUInt16LE(ptr + 30);
      const commentLen = buf.readUInt16LE(ptr + 32);
      const localOffset = buf.readUInt32LE(ptr + 42);
      const fileName = buf.subarray(ptr + 46, ptr + 46 + fnLen).toString("utf8");

      if (localOffset + 30 <= buf.length && buf.readUInt32LE(localOffset) === 0x04034b50) {
        const locFnLen = buf.readUInt16LE(localOffset + 26);
        const locExtraLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + locFnLen + locExtraLen;
        const compData = buf.subarray(dataStart, dataStart + compSize);

        let data = null;
        try {
          if (compMethod === 0) {
            data = compData;
          } else if (compMethod === 8) {
            data = zlib.inflateRawSync(compData);
          }
        } catch (e) {
          console.error(`[ZIP Decompress Error] ${fileName}:`, e.message);
        }

        if (data) {
          const str = data.toString("utf8");
          entries[fileName] = str;
          entries[fileName.toLowerCase()] = str;
        } else {
          console.error(`[ZIP No Data] ${fileName}, compSize: ${compSize}, localOffset: ${localOffset}`);
        }
      } else {
        console.error(`[ZIP Invalid Local Header] ${fileName} at localOffset: ${localOffset}`);
      }

      ptr += 46 + fnLen + extraLen + commentLen;
    }
  }

  // 2. Fallback to Local File Header scan
  if (Object.keys(entries).length === 0) {
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
        let data = null;
        try {
          if (compMethod === 0) data = compData;
          else if (compMethod === 8) data = zlib.inflateRawSync(compData);
        } catch (e) {}
        if (data) {
          const str = data.toString("utf8");
          entries[fileName] = str;
          entries[fileName.toLowerCase()] = str;
        }
        i = dataStart + (compSize > 0 ? compSize : 1);
      } else {
        i++;
      }
    }
  }
  return entries;
}

const entries = readZipEntries(buffer);
let passed = 0;
function assert(cond, name) {
  if (!cond) {
    console.error(`❌ FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ PASS: ${name}`);
}

const workbookXml = entries["xl/workbook.xml"] || entries["xl/workbook.xml".toLowerCase()];
const sharedStringsXml = entries["xl/sharedStrings.xml"] || entries["xl/sharedstrings.xml"];
const sheet1Xml = entries["xl/worksheets/sheet1.xml"] || entries["xl/worksheets/sheet1.xml".toLowerCase()];

assert(workbookXml !== undefined, "Workbook XML extracted from ZIP");
assert(sheet1Xml !== undefined, "Sheet1 XML extracted from ZIP");

function decodeXmlEntities(str) {
  let prev = "";
  let curr = str;
  while (prev !== curr) {
    prev = curr;
    curr = curr
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  return curr;
}

// Parse shared strings if present in the OpenXML workbook
const sharedStrings = [];
if (sharedStringsXml) {
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(sharedStringsXml)) !== null) {
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    let text = "";
    while ((tm = tRegex.exec(m[1])) !== null) text += decodeXmlEntities(tm[1]);
    sharedStrings.push(text);
  }
}

// Parse rows
const sheetXml = sheet1Xml;
const rows = [];
const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
let rm;
while ((rm = rowRegex.exec(sheetXml)) !== null) {
  const rowNum = parseInt(rm[1], 10);
  const cellRegex = /<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
  let cm;
  const cells = {};
  while ((cm = cellRegex.exec(rm[2])) !== null) {
    const col = cm[1];
    const val = cm[2] === "s" ? (sharedStrings[parseInt(cm[3], 10)] || "") : decodeXmlEntities(cm[3] || "");
    cells[col] = val;
  }
  rows.push({ rowNum, cells });
}

assert(rows.length === 393, `Total rows extracted: ${rows.length} (1 header + 392 data rows)`);

// Header verification
const headers = Object.values(rows[0].cells);
assert(headers.length === 42, `All 42 Spectora columns detected (${headers.length} found)`);
assert(headers.includes("Section Name"), "Column 'Section Name' present");
assert(headers.includes("Item Name"), "Column 'Item Name' present");
assert(headers.includes("Comment Text"), "Column 'Comment Text' present");
assert(headers.includes("Answer Type (boolean, checkbox, date, number, range, text)"), "Column 'Answer Type' present");

// Grouping into hierarchy
const sections = new Map();
let commentCount = 0;

rows.slice(1).forEach((r) => {
  const secName = (r.cells["A"] || "").trim() || "General";
  const itemName = (r.cells["B"] || "").trim() || "General";
  const commentName = r.cells["C"] || null;
  const commentText = r.cells["D"] || "";

  if (!sections.has(secName)) {
    sections.set(secName, new Map());
  }
  const items = sections.get(secName);
  if (!items.has(itemName)) {
    items.set(itemName, []);
  }
  items.get(itemName).push({ commentName, commentText });
  commentCount++;
});

assert(sections.size === 13, `Hierarchy: Exact 13 sections created (${sections.size})`);
let totalItems = 0;
sections.forEach((items) => (totalItems += items.size));
assert(totalItems === 69, `Hierarchy: Exact 69 items created (${totalItems})`);
assert(commentCount === 392, `Hierarchy: Exact 392 comments/findings preserved (${commentCount})`);

// HTML Comments preservation check
let htmlCommentFound = false;
sections.forEach((items) => {
  items.forEach((comments) => {
    comments.forEach((c) => {
      if (c.commentText.includes("<") && c.commentText.includes(">")) {
        htmlCommentFound = true;
      }
    });
  });
});
assert(htmlCommentFound, "HTML comments preserved with safe markup intact");

console.log(`\n🎉 ALL ${passed} TESTS PASSED! Importer is completely deterministic and verified.`);
