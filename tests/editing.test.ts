import { templateRepository } from "@/db/repositories/templateRepository";
import { sectionRepository } from "@/db/repositories/sectionRepository";
import { itemRepository } from "@/db/repositories/itemRepository";
import { commentRepository } from "@/db/repositories/commentRepository";

/**
 * Verification Test Suite for Template Editing Persistence
 * Tests:
 * 1. Section name change persists
 * 2. Item name change persists
 * 3. Comment narrative & text change persists
 * 4. Refresh / Re-query retains all changes
 * 5. Unrelated records remain untouched
 */
export async function runEditingTests(): Promise<{
  passed: boolean;
  totalChecks: number;
  summary: string[];
}> {
  let totalChecks = 0;
  const summary: string[] = [];

  function assert(condition: boolean, testName: string) {
    totalChecks++;
    if (!condition) {
      throw new Error(`[FAIL] ${testName}`);
    }
    summary.push(`[PASS] ${testName}`);
  }

  // 1. Create Baseline Template
  const created = await templateRepository.createTemplate({
    name: "Editing Baseline Template",
    description: "Template for verifying editing persistence",
    originalSource: "spectora",
    sections: [
      {
        id: "sec-edit-1",
        templateId: "tpl-edit-test",
        name: "Roofing Original",
        orderIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: "item-edit-1",
            sectionId: "sec-edit-1",
            name: "Flashings Original",
            orderIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            comments: [
              {
                id: "comm-edit-1",
                itemId: "item-edit-1",
                commentName: "Step Flashing Original",
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
      {
        id: "sec-edit-2",
        templateId: "tpl-edit-test",
        name: "Unrelated Section",
        orderIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      },
    ],
  });

  assert(created !== null, "Created baseline template for editing test");
  const templateId = created!.id;

  // 2. Perform Edits:
  // A. Section Name Change
  const updatedSec = await sectionRepository.updateSection("sec-edit-1", {
    name: "Roofing System (Renamed)",
  });
  assert(updatedSec !== null && updatedSec.name === "Roofing System (Renamed)", "Section name updated in repository");

  // B. Item Name Change
  const updatedItem = await itemRepository.updateItem("item-edit-1", {
    name: "Roof Coverings & Flashings (Renamed)",
  });
  assert(updatedItem !== null && updatedItem.name === "Roof Coverings & Flashings (Renamed)", "Item name updated in repository");

  // C. Comment Narrative Change
  const updatedComment = await commentRepository.updateComment("comm-edit-1", {
    commentName: "Step Flashing & Counter-flashing (Edited)",
    commentText: "<p>Updated finding narrative with <b>verified repair</b> details.</p>",
  });
  assert(updatedComment !== null && updatedComment.commentName === "Step Flashing & Counter-flashing (Edited)", "Comment name updated");
  assert(updatedComment !== null && Boolean(updatedComment.commentText?.includes("<b>verified repair</b>")), "Comment text updated with HTML");

  // 3. Simulate Page Refresh: Re-fetch entire template graph from database
  const refreshed = await templateRepository.getTemplateById(templateId, true);
  assert(refreshed !== null, "Successfully reloaded template after simulated refresh");

  const reloadedSec1 = refreshed!.sections?.find((s: any) => s.id === "sec-edit-1");
  const reloadedSec2 = refreshed!.sections?.find((s: any) => s.id === "sec-edit-2");
  const reloadedItem = reloadedSec1?.items?.find((it: any) => it.id === "item-edit-1");
  const reloadedComment = reloadedItem?.comments?.find((c: any) => c.id === "comm-edit-1");

  // Verify Persisted Changes Survive Refresh
  assert(reloadedSec1?.name === "Roofing System (Renamed)", "Reloaded section preserves renamed value");
  assert(reloadedItem?.name === "Roof Coverings & Flashings (Renamed)", "Reloaded item preserves renamed value");
  assert(reloadedComment?.commentName === "Step Flashing & Counter-flashing (Edited)", "Reloaded comment preserves edited name");
  assert(reloadedComment?.commentText === "<p>Updated finding narrative with <b>verified repair</b> details.</p>", "Reloaded comment preserves HTML text");

  // Verify Unrelated Records Remain Untouched
  assert(reloadedSec2?.name === "Unrelated Section", "Unrelated section remains untouched");

  // 4. Clean up
  await templateRepository.deleteTemplate(templateId);
  const deletedCheck = await templateRepository.getTemplateById(templateId);
  assert(deletedCheck === null, "Cleaned up test template");

  return {
    passed: true,
    totalChecks,
    summary,
  };
}
