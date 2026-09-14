const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

console.log("================================================================");
console.log("   HIVE INSPECT — TEMPLATE DATABASE SEEDER");
console.log("================================================================\n");

// Helper to parse .env.local or .env
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const fixturePath = path.resolve(__dirname, "../fixtures/Residential Template-2026-09-14.xls");
if (!fs.existsSync(fixturePath)) {
  console.error("Fixture not found at:", fixturePath);
  process.exit(1);
}

const buffer = fs.readFileSync(fixturePath);

// 1. Decompress OpenXML ZIP
function extractZip(buf) {
  const entries = {};
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
          if (compMethod === 0) data = compData;
          else if (compMethod === 8) data = zlib.inflateRawSync(compData);
        } catch (e) {}

        if (data) {
          const str = data.toString("utf8");
          entries[fileName] = str;
          entries[fileName.toLowerCase()] = str;
        }
      }
      ptr += 46 + fnLen + extraLen + commentLen;
    }
  }
  return entries;
}

const entries = extractZip(buffer);
const sheet1Xml = entries["xl/worksheets/sheet1.xml"] || entries["xl/worksheets/sheet1.xml".toLowerCase()];
const sharedStringsXml = entries["xl/sharedStrings.xml"] || entries["xl/sharedstrings.xml"];

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

const sharedStrings = [];
if (sharedStringsXml) {
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let siMatch;
  while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    let text = "";
    while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
      text += decodeXmlEntities(tMatch[1]);
    }
    sharedStrings.push(text);
  }
}

// Parse rows
const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
let rMatch;
const rawRows = [];

while ((rMatch = rowRegex.exec(sheet1Xml)) !== null) {
  const rowContent = rMatch[2];
  const cRegex = /<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
  let cMatch;
  const cells = {};
  while ((cMatch = cRegex.exec(rowContent)) !== null) {
    const col = cMatch[1];
    const type = cMatch[2];
    const rawVal = cMatch[3] || "";
    cells[col] = type === "s" ? (sharedStrings[parseInt(rawVal, 10)] || "") : decodeXmlEntities(rawVal);
  }
  rawRows.push(cells);
}

// Extract headers
const headerRow = rawRows[0];
const colMap = {};
for (const [col, val] of Object.entries(headerRow)) {
  const norm = val.toLowerCase().trim();
  if (norm === "section name" || norm === "section") colMap.sec = col;
  if (norm === "item name" || norm === "item") colMap.item = col;
  if (norm === "comment name") colMap.cName = col;
  if (norm === "comment text") colMap.cText = col;
  if (norm.includes("answer type")) colMap.answerType = col;
  if (norm.includes("order")) colMap.order = col;
}

// Build 4-tier model with valid UUIDs
const templateId = crypto.randomUUID();
const now = new Date().toISOString();

const sectionsMap = new Map();
let secOrder = 0;

for (let r = 1; r < rawRows.length; r++) {
  const row = rawRows[r];
  const secName = decodeXmlEntities((row[colMap.sec] || "").trim()) || "General";
  const itemName = decodeXmlEntities((row[colMap.item] || "").trim()) || "General";
  const cName = decodeXmlEntities((row[colMap.cName] || "").trim()) || null;
  const cText = decodeXmlEntities((row[colMap.cText] || "").trim()) || "";
  const answerType = (row[colMap.answerType] || "").trim() || "checkbox";

  if (!sectionsMap.has(secName)) {
    const secId = crypto.randomUUID();
    sectionsMap.set(secName, {
      id: secId,
      templateId,
      name: secName,
      orderIndex: secOrder++,
      itemsMap: new Map(),
    });
  }

  const sec = sectionsMap.get(secName);
  if (!sec.itemsMap.has(itemName)) {
    const itId = crypto.randomUUID();
    const itOrder = sec.itemsMap.size;
    sec.itemsMap.set(itemName, {
      id: itId,
      templateId,
      sectionId: sec.id,
      name: itemName,
      orderIndex: itOrder,
      comments: [],
    });
  }

  const it = sec.itemsMap.get(itemName);
  const commId = crypto.randomUUID();
  const commOrder = it.comments.length;
  it.comments.push({
    id: commId,
    templateId,
    sectionId: sec.id,
    itemId: it.id,
    commentName: cName,
    commentText: cText,
    contentFormat: cText.includes("<") && cText.includes(">") ? "html" : "plain",
    answerType,
    orderIndex: commOrder,
    createdAt: now,
    updatedAt: now,
  });
}

// Convert Map to final TemplateWithRelations
const sections = [];
const allDbSections = [];
const allDbItems = [];
const allDbComments = [];

for (const sec of sectionsMap.values()) {
  const items = [];
  allDbSections.push({
    id: sec.id,
    template_id: templateId,
    name: sec.name,
    order_index: sec.orderIndex,
    created_at: now,
    updated_at: now,
  });

  for (const it of sec.itemsMap.values()) {
    allDbItems.push({
      id: it.id,
      section_id: sec.id,
      name: it.name,
      order_index: it.orderIndex,
      created_at: now,
      updated_at: now,
    });

    items.push({
      id: it.id,
      templateId: it.templateId,
      sectionId: it.sectionId,
      name: it.name,
      orderIndex: it.orderIndex,
      createdAt: now,
      updatedAt: now,
      comments: it.comments.map((c) => ({
        id: c.id,
        templateId: c.templateId,
        sectionId: c.sectionId,
        itemId: c.itemId,
        name: c.commentName,
        text: c.commentText,
        contentFormat: c.contentFormat,
        answerType: c.answerType,
        orderIndex: c.orderIndex,
        createdAt: now,
        updatedAt: now,
      })),
    });

    for (const c of it.comments) {
      allDbComments.push({
        id: c.id,
        item_id: it.id,
        comment_name: c.commentName,
        comment_text: c.commentText,
        content_format: c.contentFormat,
        answer_type: c.answerType,
        order_index: c.orderIndex,
        created_at: now,
        updated_at: now,
      });
    }
  }

  sections.push({
    id: sec.id,
    templateId: sec.templateId,
    name: sec.name,
    orderIndex: sec.orderIndex,
    createdAt: now,
    updatedAt: now,
    items,
  });
}

const seedTemplate = {
  id: templateId,
  name: "Residential Template (InterNACHI)",
  description: "Standard residential home inspection template imported from Spectora HTML-text export.",
  originalSource: "spectora",
  sourceFilename: "Residential Template-2026-09-14.xls",
  sourceMetadata: {
    format: "OpenXML Spreadsheet",
    sourceSheet: "Sheet1",
    totalRows: rawRows.length,
    columnsDetected: Object.keys(headerRow).length,
  },
  createdAt: now,
  updatedAt: now,
  sections,
};

// 1. Write offline JSON artifact
const jsonOutPath = path.resolve(__dirname, "../fixtures/seed_template.json");
fs.writeFileSync(jsonOutPath, JSON.stringify(seedTemplate, null, 2), "utf8");
console.log(`✅ Saved offline seed fixture: fixtures/seed_template.json`);

// 2. If Supabase credentials are configured, seed Supabase directly
async function seedSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isPlaceholderServiceKey = !rawServiceKey || rawServiceKey.includes("your-service-role-key");
  const supabaseKey = !isPlaceholderServiceKey ? rawServiceKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project-id") || supabaseKey.includes("your-anon-public-key")) {
    console.log("ℹ Note: Supabase not configured in .env.local — using in-memory auto-seed mode.");
    return;
  }

  console.log("Connecting to Supabase to seed database tables...");
  let createClient;
  try {
    createClient = require("@supabase/supabase-js").createClient;
  } catch {
    console.log("Could not load @supabase/supabase-js. Skipping direct cloud insert.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check if already seeded
  const { data: existing } = await supabase
    .from("templates")
    .select("id")
    .eq("name", seedTemplate.name)
    .maybeSingle();

  if (existing) {
    console.log(`✅ Template '${seedTemplate.name}' is already present in Supabase (ID: ${existing.id}).`);
    return;
  }

  console.log("Inserting template record into Supabase...");
  const { error: tErr } = await supabase.from("templates").insert({
    id: templateId,
    name: seedTemplate.name,
    description: seedTemplate.description,
    original_source: seedTemplate.originalSource,
    source_filename: seedTemplate.sourceFilename,
    source_metadata: seedTemplate.sourceMetadata,
  });

  if (tErr) {
    console.error("❌ Failed to insert template into Supabase:", tErr.message);
    return;
  }

  console.log(`Inserting ${allDbSections.length} sections...`);
  const { error: sErr } = await supabase.from("sections").insert(allDbSections);
  if (sErr) {
    console.error("❌ Failed to insert sections:", sErr.message);
    return;
  }

  console.log(`Inserting ${allDbItems.length} items...`);
  const { error: iErr } = await supabase.from("items").insert(allDbItems);
  if (iErr) {
    console.error("❌ Failed to insert items:", iErr.message);
    return;
  }

  console.log(`Inserting ${allDbComments.length} comments...`);
  // Chunk comments in batches of 100 to avoid payload size limits
  for (let i = 0; i < allDbComments.length; i += 100) {
    const chunk = allDbComments.slice(i, i + 100);
    const { error: cErr } = await supabase.from("comments").insert(chunk);
    if (cErr) {
      console.error(`❌ Failed to insert comment chunk ${i}:`, cErr.message);
      return;
    }
  }

  console.log("✅ Seeded template directly into Supabase PostgreSQL database!");
}

seedSupabase().then(() => {
  let totalItems = 0;
  let totalComments = 0;
  sections.forEach((s) => {
    totalItems += s.items.length;
    s.items.forEach((it) => {
      totalComments += it.comments.length;
    });
  });

  console.log(`\n================================================================`);
  console.log(`🎉 SEEDING COMPLETE!`);
  console.log(`   - Template: ${seedTemplate.name}`);
  console.log(`   - Sections: ${sections.length}`);
  console.log(`   - Items: ${totalItems}`);
  console.log(`   - Comments: ${totalComments}`);
  console.log(`================================================================\n`);
});
