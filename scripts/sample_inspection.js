const fs = require("fs");
const path = require("path");

const analysis = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/analysis_summary.json"), "utf8")
);

const summary = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/analysis_summary.json"), "utf8")
);

// Read raw shared strings and sheet1 again to get exact samples of HTML comments
const targetFile = path.resolve(__dirname, "../fixtures/Residential Template-2026-09-14.xls");
const buffer = fs.readFileSync(targetFile);

const zlib = require("zlib");
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
        if (compMethod === 0) data = compData;
        else if (compMethod === 8) data = zlib.inflateRawSync(compData);
      } catch (e) {}
      if (data) entries[fileName] = data.toString("utf8");
      i = dataStart + compSize;
    } else {
      i++;
    }
  }
  return entries;
}

const entries = readZipEntries(buffer);
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

const colLetterToName = summary["15_colLetterToName"];
const dataRows = rows.slice(1);

const answerTypes = new Set();
const commentTypes = new Set();
const categories = new Set();
const htmlComments = [];
const recommendations = [];
const unitTypeOptions = [];

dataRows.forEach((r) => {
  const row = {};
  for (const [colLetter, name] of Object.entries(colLetterToName)) {
    row[name] = r.cells[colLetter] || "";
  }

  const at = row["Answer Type (boolean, checkbox, date, number, range, text)"];
  if (at) answerTypes.add(at);

  const ct = row["Comment Type (info, limit, defect)"];
  if (ct) commentTypes.add(ct);

  const cat = row["Category (-1: Low, 0: Med, 1: High)"];
  if (cat) categories.add(cat);

  const text = row["Comment Text"];
  if (text) {
    htmlComments.push({
      section: row["Section Name"],
      item: row["Item Name"],
      commentName: row["Comment Name"],
      text: text,
      hasHtmlTags: text.includes("<") && text.includes(">"),
    });
  }

  const rec = row["Recommendation (from list)"];
  if (rec) recommendations.push(rec);

  const ut = row["Unit Type Options (numeric answers only, comma-separated)"];
  if (ut) unitTypeOptions.push(ut);
});

console.log("=== DETAILED FINDINGS ===");
console.log("Answer Types:", Array.from(answerTypes));
console.log("Comment Types:", Array.from(commentTypes));
console.log("Categories:", Array.from(categories));
console.log("Total rows with Comment Text:", htmlComments.length);
console.log("Rows with actual HTML tags in Comment Text:", htmlComments.filter((c) => c.hasHtmlTags).length);
console.log("Sample Comment with HTML tags:", htmlComments.find((c) => c.hasHtmlTags));
console.log("Sample plain Comment:", htmlComments.find((c) => !c.hasHtmlTags));
console.log("Recommendations found:", recommendations);
console.log("Unit Type Options found:", unitTypeOptions);

// Save deep inspection
fs.writeFileSync(
  path.resolve(__dirname, "../fixtures/deep_inspection.json"),
  JSON.stringify(
    {
      answerTypes: Array.from(answerTypes),
      commentTypes: Array.from(commentTypes),
      categories: Array.from(categories),
      htmlCommentsSample: htmlComments.slice(0, 10),
      recommendations,
      unitTypeOptions,
    },
    null,
    2
  )
);
