import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  templateRepository,
  sectionRepository,
  itemRepository,
  commentRepository,
} from "@/db/repositories";
import { getSupabaseClient } from "@/db/client";
import {
  batchUpdateSchema,
  BatchUpdateInput,
} from "@/validation/template";

export const dynamic = "force-dynamic";

export type BatchUpdateRequest = BatchUpdateInput;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const templateId = params.id;
  let body: BatchUpdateInput;

  try {
    const rawJson = await req.json();
    // Strict schema parsing & validation via Zod
    body = batchUpdateSchema.parse(rawJson);
  } catch (err: any) {
    if (err instanceof ZodError) {
      const issueSummary = err.issues
        .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
        .join("; ");
      return NextResponse.json(
        {
          success: false,
          error: `Validation error: ${issueSummary}`,
          details: err.format(),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Invalid JSON request payload." },
      { status: 400 }
    );
  }

  // --- Strategy A: Atomic PostgreSQL Transaction via 'pg' ---
  // Guarantees ACID atomicity: If update 5 of 20 fails, items 1-4 are rolled back.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    let Client: any;
    try {
      Client = require("pg").Client;
    } catch {
      Client = null;
    }

    if (Client) {
      const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });

      let inTransaction = false;

      try {
        await client.connect();
        await client.query("BEGIN");
        inTransaction = true;

        // 1. Update Template Root
        if (body.templateName !== undefined || body.templateDescription !== undefined) {
          const sets: string[] = ["updated_at = NOW()"];
          const values: any[] = [];
          let paramIdx = 1;

          if (body.templateName !== undefined) {
            sets.push(`name = $${paramIdx++}`);
            values.push(body.templateName);
          }
          if (body.templateDescription !== undefined) {
            sets.push(`description = $${paramIdx++}`);
            values.push(body.templateDescription);
          }
          values.push(templateId);

          const res = await client.query(
            `UPDATE templates SET ${sets.join(", ")} WHERE id = $${paramIdx}`,
            values
          );
          if (res.rowCount === 0) {
            const err: any = new Error(`Template '${templateId}' not found.`);
            err.failedItem = { type: "template", id: templateId, error: "Template not found" };
            throw err;
          }
        }

        // 2. Update Sections
        if (body.sections && Array.isArray(body.sections)) {
          for (const sec of body.sections) {
            if (sec.id && sec.name !== undefined) {
              try {
                const res = await client.query(
                  `UPDATE sections SET name = $1, updated_at = NOW() WHERE id = $2 AND template_id = $3`,
                  [sec.name.trim(), sec.id, templateId]
                );
                if (res.rowCount === 0) {
                  const err: any = new Error(`Section '${sec.id}' not found under template '${templateId}'.`);
                  err.failedItem = { type: "section", id: sec.id, error: "Section not found under template" };
                  throw err;
                }
              } catch (e: any) {
                if (!e.failedItem) {
                  e.failedItem = { type: "section", id: sec.id, error: e.message || "Failed to update section" };
                }
                throw e;
              }
            }
          }
        }

        // 3. Update Items
        if (body.items && Array.isArray(body.items)) {
          for (const it of body.items) {
            if (it.id && it.name !== undefined) {
              try {
                const res = await client.query(
                  `UPDATE items SET name = $1, updated_at = NOW() WHERE id = $2`,
                  [it.name.trim(), it.id]
                );
                if (res.rowCount === 0) {
                  const err: any = new Error(`Item '${it.id}' not found.`);
                  err.failedItem = { type: "item", id: it.id, error: "Item not found" };
                  throw err;
                }
              } catch (e: any) {
                if (!e.failedItem) {
                  e.failedItem = { type: "item", id: it.id, error: e.message || "Failed to update item" };
                }
                throw e;
              }
            }
          }
        }

        // 4. Update Comments
        if (body.comments && Array.isArray(body.comments)) {
          for (const c of body.comments) {
            if (c.id) {
              const sets: string[] = ["updated_at = NOW()"];
              const values: any[] = [];
              let paramIdx = 1;

              if (c.commentName !== undefined) {
                sets.push(`comment_name = $${paramIdx++}`);
                values.push(c.commentName);
              }
              if (c.commentText !== undefined) {
                sets.push(`comment_text = $${paramIdx++}`);
                values.push(c.commentText);
              }
              if (c.commentType !== undefined) {
                sets.push(`comment_type = $${paramIdx++}`);
                values.push(c.commentType);
              }
              if (c.category !== undefined) {
                sets.push(`category = $${paramIdx++}`);
                values.push(c.category);
              }
              if (c.recommendation !== undefined) {
                sets.push(`recommendation = $${paramIdx++}`);
                values.push(c.recommendation);
              }

              if (sets.length > 1) {
                values.push(c.id);
                try {
                  const res = await client.query(
                    `UPDATE comments SET ${sets.join(", ")} WHERE id = $${paramIdx}`,
                    values
                  );
                  if (res.rowCount === 0) {
                    const err: any = new Error(`Comment '${c.id}' not found.`);
                    err.failedItem = { type: "comment", id: c.id, error: "Comment not found" };
                    throw err;
                  }
                } catch (e: any) {
                  if (!e.failedItem) {
                    e.failedItem = { type: "comment", id: c.id, error: e.message || "Failed to update comment" };
                  }
                  throw e;
                }
              }
            }
          }
        }

        // Commit transaction atomically
        await client.query("COMMIT");
        inTransaction = false;

        // Fetch and return fresh updated template
        const updated = await templateRepository.getTemplateById(templateId, true);
        return NextResponse.json({ success: true, template: updated });
      } catch (txErr: any) {
        // Full atomic rollback on any failure — zero partial saves
        if (inTransaction) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackErr) {
            console.error(`[POST /api/templates/${templateId}/batch-update] Rollback error:`, rollbackErr);
          }
        }

        console.error(`[POST /api/templates/${templateId}/batch-update] Transaction rolled back:`, txErr);
        const failedItem = txErr?.failedItem || null;
        return NextResponse.json(
          {
            success: false,
            error: `Atomic transaction failed: ${txErr?.message || "Database update error"}. All changes were rolled back to prevent inconsistent state.`,
            rollbackExecuted: true,
            failedItem,
            failedSections: failedItem?.type === "section" ? [failedItem] : [],
            failedItems: failedItem?.type === "item" ? [failedItem] : [],
            failedComments: failedItem?.type === "comment" ? [failedItem] : [],
          },
          { status: 500 }
        );
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }
  }

  // --- Strategy B: Fallback with Snapshot Rollback & Granular Failure Tracking ---
  const failedSections: Array<{ id: string; error: string }> = [];
  const failedItems: Array<{ id: string; error: string }> = [];
  const failedComments: Array<{ id: string; error: string }> = [];

  // Snapshot memory store for rollback in offline/test mode
  const memStore = templateRepository.getMemoryStore();
  const existingMem = memStore.get(templateId);
  const memorySnapshot = existingMem ? JSON.parse(JSON.stringify(existingMem)) : null;

  try {
    const supabase = getSupabaseClient();

    // Mode B1: Direct In-Memory Store (offline or test environment)
    if (!supabase && existingMem) {
      if (body.templateName !== undefined) existingMem.name = body.templateName;
      if (body.templateDescription !== undefined) existingMem.description = body.templateDescription;
      existingMem.updatedAt = new Date().toISOString();

      // Validate and update sections
      if (body.sections && Array.isArray(body.sections)) {
        for (const sec of body.sections) {
          const found = (existingMem.sections || []).find((s) => s.id === sec.id);
          if (!found) {
            failedSections.push({ id: sec.id, error: `Section '${sec.id}' not found.` });
          } else {
            found.name = sec.name.trim();
            found.updatedAt = new Date().toISOString();
          }
        }
      }

      // Validate and update items
      if (body.items && Array.isArray(body.items)) {
        for (const it of body.items) {
          let foundItem: any = null;
          for (const s of existingMem.sections || []) {
            foundItem = (s.items || []).find((i) => i.id === it.id);
            if (foundItem) break;
          }
          if (!foundItem) {
            failedItems.push({ id: it.id, error: `Item '${it.id}' not found.` });
          } else {
            foundItem.name = it.name.trim();
            foundItem.updatedAt = new Date().toISOString();
          }
        }
      }

      // Validate and update comments
      if (body.comments && Array.isArray(body.comments)) {
        for (const c of body.comments) {
          let foundComment: any = null;
          for (const s of existingMem.sections || []) {
            for (const i of s.items || []) {
              foundComment = (i.comments || []).find((cm) => cm.id === c.id);
              if (foundComment) break;
            }
            if (foundComment) break;
          }
          if (!foundComment) {
            failedComments.push({ id: c.id, error: `Comment '${c.id}' not found.` });
          } else {
            if (c.commentName !== undefined) foundComment.commentName = c.commentName;
            if (c.commentText !== undefined) foundComment.commentText = c.commentText;
            if (c.commentType !== undefined) foundComment.commentType = c.commentType;
            if (c.category !== undefined) foundComment.category = c.category;
            if (c.recommendation !== undefined) foundComment.recommendation = c.recommendation;
            foundComment.updatedAt = new Date().toISOString();
          }
        }
      }

      const hasFailures = failedSections.length > 0 || failedItems.length > 0 || failedComments.length > 0;
      if (hasFailures) {
        // Rollback memory store completely to snapshot — zero partial saves
        if (memorySnapshot) {
          memStore.set(templateId, memorySnapshot);
        }

        return NextResponse.json(
          {
            success: false,
            error: "Batch update failed. In-memory template state was rolled back to prevent partial saves.",
            rollbackExecuted: true,
            failedSections,
            failedItems,
            failedComments,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({ success: true, template: existingMem });
    }

    // Mode B2: Supabase REST Client fallback
    if (body.templateName !== undefined || body.templateDescription !== undefined) {
      await templateRepository.updateTemplate(templateId, {
        name: body.templateName,
        description: body.templateDescription,
      });
    }

    if (body.sections && Array.isArray(body.sections)) {
      for (const sec of body.sections) {
        if (sec.id && sec.name) {
          try {
            const updatedSec = await sectionRepository.updateSection(sec.id, { name: sec.name.trim() });
            if (!updatedSec) throw new Error(`Section ${sec.id} not found.`);
          } catch (e: any) {
            failedSections.push({ id: sec.id, error: e?.message || "Failed to update section" });
          }
        }
      }
    }

    if (body.items && Array.isArray(body.items)) {
      for (const it of body.items) {
        if (it.id && it.name) {
          try {
            const updatedItem = await itemRepository.updateItem(it.id, { name: it.name.trim() });
            if (!updatedItem) throw new Error(`Item ${it.id} not found.`);
          } catch (e: any) {
            failedItems.push({ id: it.id, error: e?.message || "Failed to update item" });
          }
        }
      }
    }

    if (body.comments && Array.isArray(body.comments)) {
      for (const c of body.comments) {
        if (c.id) {
          try {
            const updatedComment = await commentRepository.updateComment(c.id, {
              commentName: c.commentName ?? undefined,
              commentText: c.commentText ?? undefined,
              commentType: c.commentType ?? undefined,
              category: c.category ?? undefined,
              recommendation: c.recommendation ?? undefined,
            });
            if (!updatedComment) throw new Error(`Comment ${c.id} not found.`);
          } catch (e: any) {
            failedComments.push({ id: c.id, error: e?.message || "Failed to update comment" });
          }
        }
      }
    }

    const hasFailures = failedSections.length > 0 || failedItems.length > 0 || failedComments.length > 0;
    if (hasFailures) {
      if (memorySnapshot) {
        memStore.set(templateId, memorySnapshot);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Batch update completed with partial failures. Inspect failed items below.",
          rollbackExecuted: memorySnapshot !== null,
          failedSections,
          failedItems,
          failedComments,
        },
        { status: 422 }
      );
    }

    const updated = await templateRepository.getTemplateById(templateId, true);
    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    if (memorySnapshot) {
      memStore.set(templateId, memorySnapshot);
    }

    console.error(`[POST /api/templates/${templateId}/batch-update] Unexpected error:`, err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to persist template changes." },
      { status: 500 }
    );
  }
}

