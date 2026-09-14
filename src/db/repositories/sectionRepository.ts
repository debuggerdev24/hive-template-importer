import { getSupabaseClient } from "../client";
import { Section } from "@/types/template";
import { DbSection } from "@/types/database";

export interface CreateSectionInput {
  templateId: string;
  name: string;
  orderIndex?: number;
  sourceMetadata?: Record<string, unknown>;
}

export interface UpdateSectionInput {
  name?: string;
  orderIndex?: number;
}

export class SectionRepository {
  async getSectionsByTemplateId(templateId: string): Promise<Section[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("sections")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index", { ascending: true });

    if (error || !data) {
      console.error("[SectionRepository.getSectionsByTemplateId] Error:", error);
      return [];
    }

    return data.map((d: DbSection) => ({
      id: d.id,
      templateId: d.template_id,
      name: d.name,
      orderIndex: d.order_index,
      items: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async createSection(input: CreateSectionInput): Promise<Section | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const existing = await this.getSectionsByTemplateId(input.templateId);
      orderIndex = existing.length;
    }

    const { data, error } = await supabase
      .from("sections")
      .insert({
        template_id: input.templateId,
        name: input.name,
        order_index: orderIndex,
        source_metadata: input.sourceMetadata || {},
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[SectionRepository.createSection] Error:", error);
      return null;
    }

    const d = data as DbSection;
    return {
      id: d.id,
      templateId: d.template_id,
      name: d.name,
      orderIndex: d.order_index,
      items: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  async updateSection(id: string, input: UpdateSectionInput): Promise<Section | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("sections")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.orderIndex !== undefined ? { order_index: input.orderIndex } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[SectionRepository.updateSection] Error:", error);
      return null;
    }

    const d = data as DbSection;
    return {
      id: d.id,
      templateId: d.template_id,
      name: d.name,
      orderIndex: d.order_index,
      items: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  async deleteSection(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) {
      console.error("[SectionRepository.deleteSection] Error:", error);
      return false;
    }
    return true;
  }

  /**
   * Reorder a list of sections by ID
   */
  async reorderSections(templateId: string, orderedSectionIds: string[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const updates = orderedSectionIds.map((id, index) =>
      supabase.from("sections").update({ order_index: index }).eq("id", id).eq("template_id", templateId)
    );

    const results = await Promise.all(updates);
    return results.every((r) => !r.error);
  }
}

export const sectionRepository = new SectionRepository();
