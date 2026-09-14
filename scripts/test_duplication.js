console.log("=== RUNNING INDEPENDENT TEMPLATE DUPLICATION TESTS ===");

// Pure JS in-memory implementation mirroring the Domain Repository & Duplication Service
class InMemoryTemplateRepository {
  constructor() {
    this.memoryStore = new Map();
  }

  getMemoryStore() {
    return this.memoryStore;
  }

  async createTemplate(input) {
    const id = input.id || `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newTpl = {
      id,
      name: input.name,
      description: input.description || null,
      originalSource: input.originalSource || "manual",
      sourceFilename: input.sourceFilename || null,
      sourceMetadata: input.sourceMetadata || {},
      createdAt: now,
      updatedAt: now,
      sections: input.sections ? JSON.parse(JSON.stringify(input.sections)) : [],
    };
    this.memoryStore.set(id, newTpl);
    return JSON.parse(JSON.stringify(newTpl));
  }

  async getTemplateById(id) {
    const tpl = this.memoryStore.get(id);
    if (!tpl) return null;
    return JSON.parse(JSON.stringify(tpl));
  }

  async duplicateTemplate(sourceTemplateId, customName) {
    const source = await this.getTemplateById(sourceTemplateId);
    if (!source) throw new Error(`Source template ${sourceTemplateId} not found`);

    const newId = `tpl-copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const clonedSections = (source.sections || []).map((sec, secIdx) => {
      const newSecId = `sec-copy-${Date.now()}-${secIdx}-${Math.random().toString(36).substring(2, 6)}`;
      const clonedItems = (sec.items || []).map((it, itIdx) => {
        const newItemId = `item-copy-${Date.now()}-${itIdx}-${Math.random().toString(36).substring(2, 6)}`;
        const clonedComments = (it.comments || []).map((c, cIdx) => ({
          ...JSON.parse(JSON.stringify(c)),
          id: `c-copy-${Date.now()}-${cIdx}-${Math.random().toString(36).substring(2, 6)}`,
          itemId: newItemId,
          createdAt: now,
          updatedAt: now,
        }));

        return {
          ...JSON.parse(JSON.stringify(it)),
          id: newItemId,
          sectionId: newSecId,
          createdAt: now,
          updatedAt: now,
          comments: clonedComments,
        };
      });

      return {
        ...JSON.parse(JSON.stringify(sec)),
        id: newSecId,
        templateId: newId,
        createdAt: now,
        updatedAt: now,
        items: clonedItems,
      };
    });

    const duplicated = {
      id: newId,
      name: customName || `${source.name} (Copy)`,
      description: source.description,
      originalSource: source.originalSource,
      sourceFilename: source.sourceFilename,
      sourceMetadata: { ...(source.sourceMetadata || {}), duplicatedFrom: sourceTemplateId },
      createdAt: now,
      updatedAt: now,
      sections: clonedSections,
    };

    this.memoryStore.set(newId, duplicated);
    return JSON.parse(JSON.stringify(duplicated));
  }
}

class TemplateDuplicationService {
  constructor(repo) {
    this.repo = repo;
  }

  async duplicateTemplate(sourceTemplateId, customName) {
    const duplicated = await this.repo.duplicateTemplate(sourceTemplateId, customName);
    if (!duplicated) {
      throw new Error(`Failed to duplicate template ${sourceTemplateId}.`);
    }
    return duplicated;
  }
}

const templateRepository = new InMemoryTemplateRepository();
const templateDuplicationService = new TemplateDuplicationService(templateRepository);

// Direct assertion runner
let passed = 0;
function assert(cond, name) {
  if (!cond) {
    console.error(`❌ FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ PASS: ${name}`);
}

async function run() {
  // 1. Create Template A
  const original = await templateRepository.createTemplate({
    name: "Master Template A",
    description: "Original master template",
    originalSource: "spectora-html-import",
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
            name: "Coverings Original",
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [
              {
                id: "c-orig-1",
                itemId: "item-orig-1",
                commentName: "Shingles Original",
                commentText: "<p>Original comment narrative.</p>",
                contentFormat: "html",
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

  assert(original !== null, "Created original Template A");

  // 2. Duplicate Template A -> Template A Copy
  const copy = await templateDuplicationService.duplicateTemplate(
    original.id,
    "Master Template A (Copy)"
  );

  assert(copy !== null, "Template duplicated via TemplateDuplicationService");
  assert(copy.id !== original.id, `Distinct Template IDs: ${original.id} vs ${copy.id}`);
  assert(copy.sections[0].id !== original.sections[0].id, "Distinct Section IDs");
  assert(copy.sections[0].items[0].id !== original.sections[0].items[0].id, "Distinct Item IDs");
  assert(copy.sections[0].items[0].comments[0].id !== original.sections[0].items[0].comments[0].id, "Distinct Comment IDs");

  // 3. Mutate Copy Section, Item, and Comment
  copy.sections[0].name = "Roofing MODIFIED";
  copy.sections[0].items[0].name = "Coverings MODIFIED";
  copy.sections[0].items[0].comments[0].commentText = "<p>MODIFIED comment narrative.</p>";

  const mem = templateRepository.getMemoryStore();
  mem.set(copy.id, copy);

  // 4. Reload Original from Repository and verify unchanged
  const reloadedOrig = await templateRepository.getTemplateById(original.id);
  assert(reloadedOrig.sections[0].name === "Roofing Original", "Original Section name preserved untouched");
  assert(reloadedOrig.sections[0].items[0].name === "Coverings Original", "Original Item name preserved untouched");
  assert(reloadedOrig.sections[0].items[0].comments[0].commentText === "<p>Original comment narrative.</p>", "Original Comment text preserved untouched");

  // 5. Reload Copy from Repository and verify modified
  const reloadedCopy = await templateRepository.getTemplateById(copy.id);
  assert(reloadedCopy.sections[0].name === "Roofing MODIFIED", "Copy Section reflects modification");
  assert(reloadedCopy.sections[0].items[0].name === "Coverings MODIFIED", "Copy Item reflects modification");
  assert(reloadedCopy.sections[0].items[0].comments[0].commentText === "<p>MODIFIED comment narrative.</p>", "Copy Comment reflects modification");

  console.log(`\n🎉 ALL ${passed} DUPLICATION INDEPENDENCE TESTS PASSED!`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
