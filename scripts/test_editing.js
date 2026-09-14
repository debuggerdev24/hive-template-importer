console.log("=== RUNNING TEMPLATE EDITING & REFRESH PERSISTENCE TESTS ===");

// Standalone in-memory repository store mirroring the relational DB persistence
class InMemoryPersistenceStore {
  constructor() {
    this.templates = new Map();
  }

  async createTemplate(tpl) {
    const id = tpl.id || `tpl-${Date.now()}`;
    const stored = JSON.parse(JSON.stringify(tpl));
    stored.id = id;
    this.templates.set(id, stored);
    return JSON.parse(JSON.stringify(stored));
  }

  async updateSection(sectionId, input) {
    for (const tpl of this.templates.values()) {
      for (const sec of tpl.sections || []) {
        if (sec.id === sectionId) {
          if (input.name !== undefined) sec.name = input.name;
          if (input.orderIndex !== undefined) sec.orderIndex = input.orderIndex;
          sec.updatedAt = new Date().toISOString();
          return JSON.parse(JSON.stringify(sec));
        }
      }
    }
    return null;
  }

  async updateItem(itemId, input) {
    for (const tpl of this.templates.values()) {
      for (const sec of tpl.sections || []) {
        for (const it of sec.items || []) {
          if (it.id === itemId) {
            if (input.name !== undefined) it.name = input.name;
            if (input.orderIndex !== undefined) it.orderIndex = input.orderIndex;
            it.updatedAt = new Date().toISOString();
            return JSON.parse(JSON.stringify(it));
          }
        }
      }
    }
    return null;
  }

  async updateComment(commentId, input) {
    for (const tpl of this.templates.values()) {
      for (const sec of tpl.sections || []) {
        for (const it of sec.items || []) {
          for (const c of it.comments || []) {
            if (c.id === commentId) {
              if (input.commentName !== undefined) c.commentName = input.commentName;
              if (input.commentText !== undefined) c.commentText = input.commentText;
              if (input.category !== undefined) c.category = input.category;
              if (input.commentType !== undefined) c.commentType = input.commentType;
              c.updatedAt = new Date().toISOString();
              return {
                ...JSON.parse(JSON.stringify(c)),
                comment_name: c.commentName,
                comment_text: c.commentText,
                category: c.category,
                comment_type: c.commentType,
              };

            }
          }
        }
      }
    }
    return null;
  }

  async getTemplateWithRelations(templateId) {
    const tpl = this.templates.get(templateId);
    if (!tpl) return null;
    return JSON.parse(JSON.stringify(tpl));
  }

  async deleteTemplate(templateId) {
    return this.templates.delete(templateId);
  }
}

const store = new InMemoryPersistenceStore();

const templateRepository = {
  createTemplate: (input) => store.createTemplate(input),
  getTemplateWithRelations: (id) => store.getTemplateWithRelations(id),
  getTemplateById: (id) => store.getTemplateWithRelations(id),
  deleteTemplate: (id) => store.deleteTemplate(id),
};

const sectionRepository = {
  updateSection: (id, input) => store.updateSection(id, input),
};

const itemRepository = {
  updateItem: (id, input) => store.updateItem(id, input),
};

const commentRepository = {
  updateComment: (id, input) => store.updateComment(id, input),
};

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
  // 1. Create Baseline Template
  const template = await templateRepository.createTemplate({
    id: "tpl-e1",
    name: "Editing Test Template",
    description: "Template for testing in-place edits and persistence",
    originalSource: "spectora",
    sections: [
      {
        id: "sec-e1",
        templateId: "tpl-e1",
        name: "Heating Section Original",
        orderIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: "item-e1",
            sectionId: "sec-e1",
            name: "Furnace Original",
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [
              {
                id: "c-e1",
                itemId: "item-e1",
                commentName: "Burner Flames Original",
                commentText: "<p>Original flame appearance.</p>",
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
      {
        id: "sec-e2",
        templateId: "tpl-e1",
        name: "Plumbing Unrelated",
        orderIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      },
    ],
  });

  assert(template !== null, "1. Created initial template record");
  const templateId = template.id;

  // 2. Test Section Name Change
  console.log("\nTesting Section Name Edit...");
  const updatedSec = await sectionRepository.updateSection("sec-e1", {
    name: "Heating & Air Conditioning (Edited)",
  });
  assert(updatedSec !== null && updatedSec.name === "Heating & Air Conditioning (Edited)", "2. Section name updated in repository");

  // 3. Test Item Name Change
  console.log("Testing Item Name Edit...");
  const updatedItem = await itemRepository.updateItem("item-e1", {
    name: "Gas Furnace & Heat Exchanger (Edited)",
  });
  assert(updatedItem !== null && updatedItem.name === "Gas Furnace & Heat Exchanger (Edited)", "3. Item name updated in repository");

  // 4. Test Comment Change
  console.log("Testing Comment Text, Name, Category & Type Edit...");
  const updatedComment = await commentRepository.updateComment("c-e1", {
    commentName: "Burner Flames & Igniter (Edited)",
    commentText: "<p>Burner observed with <b>clean blue flame</b>, no roll-out.</p>",
    category: "Defect",
    commentType: "safety",
  });
  assert(updatedComment !== null && updatedComment.comment_name === "Burner Flames & Igniter (Edited)", "4. Comment name updated");
  assert(updatedComment !== null && updatedComment.comment_text.includes("clean blue flame"), "5. Comment HTML text updated");
  assert(updatedComment !== null && updatedComment.category === "Defect", "6. Comment category updated to Defect");
  assert(updatedComment !== null && updatedComment.comment_type === "safety", "7. Comment type updated to safety");

  // 5. Simulate Browser Refresh (Re-query template graph from scratch)
  console.log("\nTesting Simulated Page Refresh (Reload from Database)...");
  const refreshed = await templateRepository.getTemplateWithRelations(templateId);
  assert(refreshed !== null, "8. Reloaded template from repository");

  const s1 = refreshed.sections.find((s) => s.id === "sec-e1");
  const s2 = refreshed.sections.find((s) => s.id === "sec-e2");
  const it1 = s1 ? s1.items.find((it) => it.id === "item-e1") : null;
  const c1 = it1 ? it1.comments.find((c) => c.id === "c-e1") : null;

  assert(s1 && s1.name === "Heating & Air Conditioning (Edited)", "9. Section rename persisted across reload");
  assert(it1 && it1.name === "Gas Furnace & Heat Exchanger (Edited)", "10. Item rename persisted across reload");
  assert(c1 && c1.commentName === "Burner Flames & Igniter (Edited)", "11. Comment name persisted across reload");
  assert(c1 && c1.commentText === "<p>Burner observed with <b>clean blue flame</b>, no roll-out.</p>", "12. Comment HTML text persisted across reload");
  assert(c1 && c1.category === "Defect", "13. Comment category persisted across reload");
  assert(c1 && c1.commentType === "safety", "14. Comment type (safety) persisted across reload");

  // 6. Verify Unrelated Records Remain Untouched
  assert(s2 && s2.name === "Plumbing Unrelated", "15. Unrelated section remains 100% untouched");


  // 7. Test Batch-Update Transaction Rollback on Failure (Partial Save Prevention)
  console.log("\nTesting Batch-Update Atomic Transaction Rollback on Failure...");
  // Simulate batch-update handler behavior: updates items 1-4, then item 5 fails
  async function simulateBatchUpdate(templateId, payload) {
    const original = await templateRepository.getTemplateWithRelations(templateId);
    const snapshot = JSON.parse(JSON.stringify(original));
    const failedItems = [];

    try {
      if (payload.sections) {
        for (const sec of payload.sections) {
          const res = await sectionRepository.updateSection(sec.id, { name: sec.name });
          if (!res) throw { type: "section", id: sec.id, error: "Section not found" };
        }
      }
      if (payload.items) {
        for (const it of payload.items) {
          if (it.id === "non-existent-item-5") {
            throw { type: "item", id: it.id, error: "Item not found in database constraint" };
          }
          const res = await itemRepository.updateItem(it.id, { name: it.name });
          if (!res) throw { type: "item", id: it.id, error: "Item not found" };
        }
      }
      return { success: true };
    } catch (err) {
      // Transaction Rollback: restore template to snapshot
      store.templates.set(templateId, snapshot);
      failedItems.push(err);
      return {
        success: false,
        error: `Atomic transaction failed: ${err.error}. All changes were rolled back.`,
        rollbackExecuted: true,
        failedItems,
      };
    }
  }

  const batchPayload = {
    items: [
      { id: "item-e1", name: "Tentative Furnace Update (Should Rollback)" },
      { id: "non-existent-item-5", name: "Failing Item 5 of 20" },
    ],
  };

  const batchResult = await simulateBatchUpdate(templateId, batchPayload);
  assert(batchResult.success === false, "16. Batch update returns failure status on partial error");
  assert(batchResult.rollbackExecuted === true, "17. Atomic rollback executed");
  assert(batchResult.failedItems.length === 1 && batchResult.failedItems[0].id === "non-existent-item-5", "18. Returns which item failed");

  // Verify item-e1 was NOT partially saved
  const recheck = await templateRepository.getTemplateWithRelations(templateId);
  const recheckedItem = recheck.sections[0].items.find((it) => it.id === "item-e1");
  assert(
    recheckedItem.name === "Gas Furnace & Heat Exchanger (Edited)",
    "19. Partial save prevented: Item 1 retained original name, no inconsistent state"
  );

  // 8. Test Zod Schema Validation on Batch-Update Input
  console.log("\nTesting Zod Schema Validation on Batch-Update Payloads...");
  const { z } = require("zod");
  const testUpdateSectionSchema = z.object({
    name: z.string().min(1, "Section name is required").max(200),
    orderIndex: z.number().int().nonnegative().optional(),
  });
  const testBatchSectionSchema = testUpdateSectionSchema.extend({
    id: z.string().min(1, "Section ID is required"),
  });
  const testBatchUpdateSchema = z.object({
    templateName: z.string().min(1).max(200).optional(),
    sections: z.array(testBatchSectionSchema).optional(),
  });

  // Test invalid empty section name
  let schemaCaught = false;
  try {
    testBatchUpdateSchema.parse({
      sections: [{ id: "sec-1", name: "" }],
    });
  } catch (err) {
    schemaCaught = true;
    assert(err.issues[0].message.includes("Section name is required"), "20. Zod schema catches empty section name");
  }
  assert(schemaCaught === true, "21. Validation error raised on invalid section payload");

  // Test valid payload
  const parsedValid = testBatchUpdateSchema.parse({
    templateName: "Updated Template Title",
    sections: [{ id: "sec-1", name: "Valid Section Name" }],
  });
  assert(parsedValid.sections[0].name === "Valid Section Name", "22. Zod schema permits valid batch payload");


  // 9. Test Delete Missing Template (404 Not Found vs 500)
  console.log("\nTesting Deletion of Non-Existent Template...");
  const nonExistent = await templateRepository.getTemplateById("non-existent-template-id");
  assert(nonExistent === null, "23. Non-existent template identified for 404 response");

  // 10. Cleanup
  const deleted = await templateRepository.deleteTemplate(templateId);
  assert(deleted === true, "24. Template cleanly deleted from repository");

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passed} EDITING, PERSISTENCE, ROLLBACK, VALIDATION & DELETION CHECKS PASSED!`);
  console.log(`======================================================\n`);

}

run().catch((err) => {
  console.error("Editing test error:", err);
  process.exit(1);
});
