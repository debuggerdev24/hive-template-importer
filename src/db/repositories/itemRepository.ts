import { getSupabaseClient } from "../client";
import { Item } from "@/types/template";
import { DbItem } from "@/types/database";

export interface CreateItemInput {
  sectionId: string;
  name: string;
  orderIndex?: number;
  sourceMetadata?: Record<string, unknown>;
}

export interface UpdateItemInput {
  name?: string;
  orderIndex?: number;
}

export class ItemRepository {
  async getItemsBySectionId(sectionId: string): Promise<Item[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("section_id", sectionId)
      .order("order_index", { ascending: true });

    if (error || !data) {
      console.error("[ItemRepository.getItemsBySectionId] Error:", error);
      return [];
    }

    return data.map((d: DbItem) => ({
      id: d.id,
      sectionId: d.section_id,
      name: d.name,
      orderIndex: d.order_index,
      comments: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async createItem(input: CreateItemInput): Promise<Item | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const existing = await this.getItemsBySectionId(input.sectionId);
      orderIndex = existing.length;
    }

    const { data, error } = await supabase
      .from("items")
      .insert({
        section_id: input.sectionId,
        name: input.name,
        order_index: orderIndex,
        source_metadata: input.sourceMetadata || {},
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[ItemRepository.createItem] Error:", error);
      return null;
    }

    const d = data as DbItem;
    return {
      id: d.id,
      sectionId: d.section_id,
      name: d.name,
      orderIndex: d.order_index,
      comments: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  async updateItem(id: string, input: UpdateItemInput): Promise<Item | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("items")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.orderIndex !== undefined ? { order_index: input.orderIndex } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[ItemRepository.updateItem] Error:", error);
      return null;
    }

    const d = data as DbItem;
    return {
      id: d.id,
      sectionId: d.section_id,
      name: d.name,
      orderIndex: d.order_index,
      comments: [],
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  async deleteItem(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) {
      console.error("[ItemRepository.deleteItem] Error:", error);
      return false;
    }
    return true;
  }

  /**
   * Reorder items within a section
   */
  async reorderItems(sectionId: string, orderedItemIds: string[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const updates = orderedItemIds.map((id, index) =>
      supabase.from("items").update({ order_index: index }).eq("id", id).eq("section_id", sectionId)
    );

    const results = await Promise.all(updates);
    return results.every((r) => !r.error);
  }
}

export const itemRepository = new ItemRepository();
