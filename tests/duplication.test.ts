import { templateRepository } from "@/db/repositories";
import { TemplateWithRelations } from "@/types/template";

/**
 * Automated Verification Test Suite for Template Duplication & Independence
 * Tests:
 * 1. Deep cloning of Template, Sections, Items, and Comments
 * 2. Distinct ID verification (original & copy do NOT share mutable records)
 * 3. Modifying copy section name leaves original unchanged
 * 4. Modifying copy item name leaves original unchanged
 * 5. Modifying copy comment text leaves original unchanged
 * 6. Reloading original from repository confirms 100% preservation
 * 7. Reloading copy confirms all mutations are preserved independently
 */
export async function runDuplicationTests(): Promise<{ passed: boolean; totalChecks: number; summary: string[] }> {
  let totalChecks = 0;
  const summary: string[] = [];

  function assert(condition: boolean, testName: string) {
    totalChecks++;
    if (!condition) {
      throw new Error(`[FAIL] ${testName}`);
    }
    summary.push(`[PASS] ${testName}`);
  }

  // 1. Setup Original Template A with nested hierarchy
  const originalTemplate = await templateRepository.createTemplate({
    name: "Master Template A",
    description: "Original master template before duplication",
    originalSource: "spectora-html-import",
    sourceFilename: "residential_master.xls",
    sections: [
      {
        id: "sec-orig-1",
        templateId: "tpl-orig",
        name: "Roofing Original",
        orderIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: "item-orig-1",
            sectionId: "sec-orig-1",
            name: "Flashings Original",
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [
              {
                id: "comm-orig-1",
                itemId: "item-orig-1",
                commentName: "Chimney Flashing Original",
                commentText: "<p>Original master comment text.</p>",
                contentFormat: "html",
                commentType: "defect",
                category: "1",
                orderIndex: 0,
                locked: false,
                simpleFormat: false,
                disablePhotos: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
    ],
  });

  if (!originalTemplate) {
    throw new Error("Failed to initialize test template");
  }

  // TEST 1: Duplicate Template A -> Template A Copy
  const duplicated = await templateRepository.duplicateTemplate(
    originalTemplate.id,
    "Master Template A (Copy)"
  );
  if (!duplicated) {
    throw new Error("Failed to duplicate template");
  }
  const copyTemplate: TemplateWithRelations = duplicated;

  assert(copyTemplate !== null, "Duplication service produces a new template");
  assert(copyTemplate.name === "Master Template A (Copy)", "Copy has custom duplicated name");
  assert(copyTemplate.id !== originalTemplate.id, "Copy receives a brand new Template ID");
  assert(copyTemplate.originalSource === `clone:${originalTemplate.id}`, "Copy records originalSource clone pointer");

  // TEST 2: Verify all entities receive distinct new IDs (no shared records)
  const origSec = originalTemplate.sections[0];
  const copySec = copyTemplate.sections[0];
  assert(copySec.id !== origSec.id, "Section receives a brand new Section ID");
  assert(copySec.templateId === copyTemplate.id, "Section points to new Template ID");

  const origItem = origSec.items[0];
  const copyItem = copySec.items[0];
  assert(copyItem.id !== origItem.id, "Item receives a brand new Item ID");
  assert(copyItem.sectionId === copySec.id, "Item points to new Section ID");

  const origComm = origItem.comments[0];
  const copyComm = copyItem.comments[0];
  assert(copyComm.id !== origComm.id, "Comment receives a brand new Comment ID");
  assert(copyComm.itemId === copyItem.id, "Comment points to new Item ID");

  // TEST 3: Mutate Copy Section, Item, and Comment
  copySec.name = "Roofing MODIFIED IN COPY";
  copyItem.name = "Flashings MODIFIED IN COPY";
  copyComm.commentText = "<p>MODIFIED comment narrative in copy only.</p>";

  // Save changes to copy in repository
  const memStore = templateRepository.getMemoryStore();
  if (memStore.has(copyTemplate.id)) {
    memStore.set(copyTemplate.id, copyTemplate);
  }

  // TEST 4 & 5: Reload Original and verify it is completely UNCHANGED
  const reloadedOriginal = await templateRepository.getTemplateById(originalTemplate.id, true);
  assert(reloadedOriginal !== null, "Original template reloads successfully");
  assert(
    reloadedOriginal?.sections[0].name === "Roofing Original",
    "Original Section name remains untouched ('Roofing Original')"
  );
  assert(
    reloadedOriginal?.sections[0].items[0].name === "Flashings Original",
    "Original Item name remains untouched ('Flashings Original')"
  );
  assert(
    reloadedOriginal?.sections[0].items[0].comments[0].commentText === "<p>Original master comment text.</p>",
    "Original Comment text remains untouched ('<p>Original master comment text.</p>')"
  );

  // TEST 6 & 7: Reload Copy and verify it contains the independent changes
  const reloadedCopy = await templateRepository.getTemplateById(copyTemplate.id, true);
  assert(reloadedCopy !== null, "Copy template reloads successfully");
  assert(
    reloadedCopy?.sections[0].name === "Roofing MODIFIED IN COPY",
    "Copy Section reflects modified name"
  );
  assert(
    reloadedCopy?.sections[0].items[0].name === "Flashings MODIFIED IN COPY",
    "Copy Item reflects modified name"
  );
  assert(
    reloadedCopy?.sections[0].items[0].comments[0].commentText === "<p>MODIFIED comment narrative in copy only.</p>",
    "Copy Comment reflects modified narrative"
  );

  return { passed: true, totalChecks, summary };
}
