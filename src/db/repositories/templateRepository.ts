import crypto from "crypto";
import { getSupabaseClient } from "../client";
import {
  Template,
  TemplateWithRelations,
  TemplateSummary,
  Section,
  Item,
  Comment,
  ContentFormat,
} from "@/types/template";
import { DbTemplate } from "@/types/database";

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  originalSource?: string;
  sourceFilename?: string | null;
  sourceMetadata?: Record<string, unknown>;
  sections?: Section[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
}

// In-Memory Storage Adapter shared globally across all Next.js API route chunks in dev/serverless
const globalForTemplates = globalThis as unknown as {
  __hiveinspect_memory_store__?: Map<string, TemplateWithRelations>;
};
const memoryStore =
  globalForTemplates.__hiveinspect_memory_store__ ||
  (globalForTemplates.__hiveinspect_memory_store__ = new Map<string, TemplateWithRelations>());

function tryLoadSeedData(): void {
  if (memoryStore.size > 0) return;
  try {
    // Safely load offline seed fixture if present
    const fs = require("fs");
    const path = require("path");
    const seedPath = path.resolve(process.cwd(), "fixtures/seed_template.json");
    if (fs.existsSync(seedPath)) {
      const data = JSON.parse(fs.readFileSync(seedPath, "utf8"));
      if (data && data.id) {
        memoryStore.set(data.id, data);
      }
    }
  } catch {
    // Graceful fallback if filesystem access is restricted
  }
}

export class TemplateRepository {
  /**
   * Helper to access in-memory store directly (useful for tests)
   */
  getMemoryStore(): Map<string, TemplateWithRelations> {
    tryLoadSeedData();
    return memoryStore;
  }

  /**
   * List all templates with summary stats (section, item, and comment counts)
   */
  async listTemplates(): Promise<TemplateSummary[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      tryLoadSeedData();
      return Array.from(memoryStore.values()).map((t) => {
        let itemCount = 0;
        let commentCount = 0;
        (t.sections || []).forEach((s) => {
          itemCount += (s.items || []).length;
          (s.items || []).forEach((it) => {
            commentCount += (it.comments || []).length;
          });
        });

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          originalSource: t.originalSource,
          sourceFilename: t.sourceFilename,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          sectionCount: (t.sections || []).length,
          itemCount,
          commentCount,
        };
      });
    }

    const { data: templates, error } = await supabase
      .from("templates")
      .select(`
        id,
        name,
        description,
        original_source,
        source_filename,
        created_at,
        updated_at,
        import_runs:import_runs (
          status,
          warning_count
        ),
        sections:sections (
          id,
          items:items (
            id,
            comments:comments (
              id
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error || !templates) {
      console.error("[TemplateRepository.listTemplates] Error:", error);
      return [];
    }

    return templates.map((t: any) => {
      const sections = t.sections || [];
      const latestRun = Array.isArray(t.import_runs) && t.import_runs.length > 0 ? t.import_runs[0] : null;
      let itemCount = 0;
      let commentCount = 0;

      sections.forEach((sec: any) => {
        const items = sec.items || [];
        itemCount += items.length;
        items.forEach((it: any) => {
          commentCount += (it.comments || []).length;
        });
      });

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        originalSource: t.original_source,
        sourceFilename: t.source_filename,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        sectionCount: sections.length,
        itemCount,
        commentCount,
        importStatus: latestRun?.status || null,
        warningCount: latestRun?.warning_count || 0,
      };
    });
  }

  /**
   * Retrieve a single template by ID, optionally including the full relational hierarchy
   */
  async getTemplateById(
    id: string,
    includeRelations: boolean = true
  ): Promise<TemplateWithRelations | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      tryLoadSeedData();
      const stored = memoryStore.get(id);
      if (!stored) return null;
      // Return a decoupled deep copy so external code cannot mutate stored memory state directly
      return JSON.parse(JSON.stringify(stored));
    }

    if (!includeRelations) {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) return null;
      return this.mapDbTemplateToDomain(data as DbTemplate, []);
    }

    // Fetch full hierarchy preserving order
    const { data: template, error } = await supabase
      .from("templates")
      .select(`
        *,
        sections:sections (
          *,
          items:items (
            *,
            comments:comments (
              *
            )
          )
        )
      `)
      .eq("id", id)
      .order("order_index", { referencedTable: "sections", ascending: true })
      .order("order_index", { referencedTable: "sections.items", ascending: true })
      .order("order_index", { referencedTable: "sections.items.comments", ascending: true })
      .single();

    if (error || !template) {
      console.error("[TemplateRepository.getTemplateById] Error:", error);
      return null;
    }

    return this.mapFullHierarchy(template);
  }

  /**
   * Create a new template record
   */
  async createTemplate(input: CreateTemplateInput): Promise<TemplateWithRelations | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const id = `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const newTpl: TemplateWithRelations = {
        id,
        name: input.name,
        description: input.description ?? null,
        originalSource: input.originalSource ?? "manual",
        sourceFilename: input.sourceFilename ?? null,
        sourceMetadata: input.sourceMetadata ?? {},
        createdAt: now,
        updatedAt: now,
        sections: input.sections ? JSON.parse(JSON.stringify(input.sections)) : [],
      };
      memoryStore.set(id, newTpl);
      return JSON.parse(JSON.stringify(newTpl));
    }

    const { data, error } = await supabase
      .from("templates")
      .insert({
        name: input.name,
        description: input.description ?? null,
        original_source: input.originalSource ?? "manual",
        source_filename: input.sourceFilename ?? null,
        source_metadata: input.sourceMetadata ?? {},
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[TemplateRepository.createTemplate] Error:", error);
      return null;
    }

    return this.mapDbTemplateToDomain(data as DbTemplate);
  }

  /**
   * Update template metadata (e.g. name, description)
   */
  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<Template | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const existing = memoryStore.get(id);
      if (!existing) return null;
      if (input.name !== undefined) existing.name = input.name;
      if (input.description !== undefined) existing.description = input.description;
      existing.updatedAt = new Date().toISOString();
      memoryStore.set(id, existing);
      return JSON.parse(JSON.stringify(existing));
    }

    const { data, error } = await supabase
      .from("templates")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[TemplateRepository.updateTemplate] Error:", error);
      return null;
    }

    return this.mapDbTemplateToDomain(data as DbTemplate);
  }

  /**
   * Delete a template (cascades to all sections, items, and comments in PostgreSQL)
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return memoryStore.delete(id);
    }

    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) {
      console.error("[TemplateRepository.deleteTemplate] Error:", error);
      return false;
    }
    return true;
  }

  /**
   * Independent Deep Clone of a Template
   * Duplicates the root template and all child sections, items, and comments with brand-new UUIDs.
   * Changes to the duplicate leave the original completely unchanged.
   */
  async duplicateTemplate(
    sourceTemplateId: string,
    customName?: string
  ): Promise<TemplateWithRelations | null> {
    const source = await this.getTemplateById(sourceTemplateId, true);
    if (!source) {
      throw new Error(`Source template ${sourceTemplateId} not found`);
    }

    const newName = customName || `${source.name} (Copy)`;
    const supabase = getSupabaseClient();

    // 1. In-Memory Deep Duplication fallback (when Supabase is unconfigured)
    if (!supabase) {
      const newId = `tpl-copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const clonedSections: Section[] = (source.sections || []).map((sec, secIdx) => {
        const newSecId = `sec-copy-${Date.now()}-${secIdx}-${Math.random().toString(36).substring(2, 6)}`;
        const clonedItems: Item[] = (sec.items || []).map((it, itIdx) => {
          const newItemId = `item-copy-${Date.now()}-${itIdx}-${Math.random().toString(36).substring(2, 6)}`;
          const clonedComments: Comment[] = (it.comments || []).map((c, cIdx) => ({
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

      const clonedTemplate: TemplateWithRelations = {
        id: newId,
        name: newName,
        description: source.description,
        originalSource: `clone:${source.id}`,
        sourceFilename: source.sourceFilename,
        sourceMetadata: {
          clonedFromId: source.id,
          clonedAt: now,
        },
        createdAt: now,
        updatedAt: now,
        sections: clonedSections,
      };

      memoryStore.set(newId, clonedTemplate);
      return JSON.parse(JSON.stringify(clonedTemplate));
    }

    // 2. Live Supabase Relational Deep Duplication
    const newTemplate = await this.createTemplate({
      name: newName,
      description: source.description,
      originalSource: `clone:${source.id}`,
      sourceFilename: source.sourceFilename,
      sourceMetadata: {
        clonedFromId: source.id,
        clonedAt: new Date().toISOString(),
      },
    });

    if (!newTemplate) return null;

    // Batch-insert cloned sections, items, and comments
    const nowStr = new Date().toISOString();
    const newSecRows: any[] = [];
    const newItemRows: any[] = [];
    const newCommentRows: any[] = [];

    for (const section of source.sections) {
      const newSecId = crypto.randomUUID();
      newSecRows.push({
        id: newSecId,
        template_id: newTemplate.id,
        name: section.name,
        order_index: section.orderIndex,
        source_metadata: section.sourceMetadata || {},
        created_at: nowStr,
        updated_at: nowStr,
      });

      for (const item of section.items) {
        const newItemId = crypto.randomUUID();
        newItemRows.push({
          id: newItemId,
          section_id: newSecId,
          name: item.name,
          order_index: item.orderIndex,
          source_metadata: item.sourceMetadata || {},
          created_at: nowStr,
          updated_at: nowStr,
        });

        for (const comment of item.comments) {
          newCommentRows.push({
            id: crypto.randomUUID(),
            item_id: newItemId,
            comment_name: comment.commentName,
            comment_text: comment.commentText,
            content_format: comment.contentFormat,
            comment_type: comment.commentType,
            category: comment.category,
            recommendation: comment.recommendation,
            order_index: comment.orderIndex,
            answer_type: comment.answerType,
            default_value: comment.defaultValue,
            default_value_2: comment.defaultValue2,
            default_unit_type: comment.defaultUnitType,
            default_location: comment.defaultLocation,
            default_estimate_min: comment.defaultEstimateMin,
            default_estimate_max: comment.defaultEstimateMax,
            locked: comment.locked,
            simple_format: comment.simpleFormat,
            disable_photos: comment.disablePhotos,
            multiple_choice_options: comment.multipleChoiceOptions || [],
            unit_type_options: comment.unitTypeOptions || [],
            default_photos_and_captions: comment.defaultPhotosAndCaptions || [],
            source_last_modified: comment.sourceLastModified,
            source_metadata: comment.sourceMetadata || {},
            created_at: nowStr,
            updated_at: nowStr,
          });
        }
      }
    }

    // 1. Insert all sections in batch
    if (newSecRows.length > 0) {
      const { error: secError } = await supabase.from("sections").insert(newSecRows);
      if (secError) {
        console.error("[duplicateTemplate] Sections batch insert error:", secError);
        return null;
      }
    }

    // 2. Insert all items in batch
    if (newItemRows.length > 0) {
      const { error: itemError } = await supabase.from("items").insert(newItemRows);
      if (itemError) {
        console.error("[duplicateTemplate] Items batch insert error:", itemError);
        return null;
      }
    }

    // 3. Insert all comments in chunks of 100
    for (let i = 0; i < newCommentRows.length; i += 100) {
      const chunk = newCommentRows.slice(i, i + 100);
      const { error: commError } = await supabase.from("comments").insert(chunk);
      if (commError) {
        console.error(`[duplicateTemplate] Comments chunk insert error:`, commError);
        return null;
      }
    }

    return this.getTemplateById(newTemplate.id, true);
  }

  // --- Helper Mapping Functions ---

  private mapDbTemplateToDomain(data: DbTemplate, sections: Section[] = []): TemplateWithRelations {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      originalSource: data.original_source,
      sourceFilename: data.source_filename,
      sourceMetadata: data.source_metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      sections,
    };
  }

  private mapFullHierarchy(raw: any): TemplateWithRelations {
    const sections: Section[] = (raw.sections || []).map((sec: any) => {
      const items: Item[] = (sec.items || []).map((it: any) => {
        const comments: Comment[] = (it.comments || []).map((c: any) => ({
          id: c.id,
          itemId: c.item_id,
          commentName: c.comment_name,
          commentText: c.comment_text,
          contentFormat: (c.content_format || "html") as ContentFormat,
          commentType: c.comment_type,
          category: c.category,
          recommendation: c.recommendation,
          orderIndex: c.order_index,
          answerType: c.answer_type,
          defaultValue: c.default_value,
          defaultValue2: c.default_value_2,
          defaultUnitType: c.default_unit_type,
          defaultLocation: c.default_location,
          defaultEstimateMin: c.default_estimate_min ? Number(c.default_estimate_min) : null,
          defaultEstimateMax: c.default_estimate_max ? Number(c.default_estimate_max) : null,
          locked: Boolean(c.locked),
          simpleFormat: Boolean(c.simple_format),
          disablePhotos: Boolean(c.disable_photos),
          multipleChoiceOptions: c.multiple_choice_options,
          unitTypeOptions: c.unit_type_options,
          defaultPhotosAndCaptions: c.default_photos_and_captions,
          sourceLastModified: c.source_last_modified,
          sourceMetadata: c.source_metadata,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));

        return {
          id: it.id,
          sectionId: it.section_id,
          name: it.name,
          orderIndex: it.order_index,
          comments,
          sourceMetadata: it.source_metadata,
          createdAt: it.created_at,
          updatedAt: it.updated_at,
        };
      });

      return {
        id: sec.id,
        templateId: sec.template_id,
        name: sec.name,
        orderIndex: sec.order_index,
        items,
        sourceMetadata: sec.source_metadata,
        createdAt: sec.created_at,
        updatedAt: sec.updated_at,
      };
    });

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      originalSource: raw.original_source,
      sourceFilename: raw.source_filename,
      sourceMetadata: raw.source_metadata,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      sections,
    };
  }
}

export const templateRepository = new TemplateRepository();
