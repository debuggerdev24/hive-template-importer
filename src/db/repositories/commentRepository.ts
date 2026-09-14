import { getSupabaseClient } from "../client";
import { Comment, ContentFormat, CommentOption, PhotoAttachment } from "@/types/template";
import { DbComment } from "@/types/database";

export interface CreateCommentInput {
  itemId: string;
  commentName?: string | null;
  commentText: string;
  contentFormat?: ContentFormat;
  commentType?: string | null;
  category?: string | null;
  recommendation?: string | null;
  orderIndex?: number;
  answerType?: string | null;
  defaultValue?: string | null;
  defaultValue2?: string | null;
  defaultUnitType?: string | null;
  defaultLocation?: string | null;
  defaultEstimateMin?: number | null;
  defaultEstimateMax?: number | null;
  locked?: boolean;
  simpleFormat?: boolean;
  disablePhotos?: boolean;
  multipleChoiceOptions?: CommentOption[] | string[];
  unitTypeOptions?: string[];
  defaultPhotosAndCaptions?: PhotoAttachment[];
  sourceLastModified?: string | null;
  sourceMetadata?: Record<string, unknown>;
}

export interface UpdateCommentInput {
  commentName?: string | null;
  commentText?: string;
  contentFormat?: ContentFormat;
  commentType?: string | null;
  category?: string | null;
  recommendation?: string | null;
  orderIndex?: number;
  defaultValue?: string | null;
  defaultLocation?: string | null;
  locked?: boolean;
}

export class CommentRepository {
  async getCommentsByItemId(itemId: string): Promise<Comment[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("item_id", itemId)
      .order("order_index", { ascending: true });

    if (error || !data) {
      console.error("[CommentRepository.getCommentsByItemId] Error:", error);
      return [];
    }

    return data.map((d: DbComment) => this.mapDbToDomain(d));
  }

  async createComment(input: CreateCommentInput): Promise<Comment | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const existing = await this.getCommentsByItemId(input.itemId);
      orderIndex = existing.length;
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({
        item_id: input.itemId,
        comment_name: input.commentName ?? null,
        comment_text: input.commentText,
        content_format: input.contentFormat ?? "html",
        comment_type: input.commentType ?? null,
        category: input.category ?? null,
        recommendation: input.recommendation ?? null,
        order_index: orderIndex,
        answer_type: input.answerType ?? null,
        default_value: input.defaultValue ?? null,
        default_value_2: input.defaultValue2 ?? null,
        default_unit_type: input.defaultUnitType ?? null,
        default_location: input.defaultLocation ?? null,
        default_estimate_min: input.defaultEstimateMin ?? null,
        default_estimate_max: input.defaultEstimateMax ?? null,
        locked: input.locked ?? false,
        simple_format: input.simpleFormat ?? false,
        disable_photos: input.disablePhotos ?? false,
        multiple_choice_options: input.multipleChoiceOptions ?? [],
        unit_type_options: input.unitTypeOptions ?? [],
        default_photos_and_captions: input.defaultPhotosAndCaptions ?? [],
        source_last_modified: input.sourceLastModified ?? null,
        source_metadata: input.sourceMetadata ?? {},
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[CommentRepository.createComment] Error:", error);
      return null;
    }

    return this.mapDbToDomain(data as DbComment);
  }

  async updateComment(id: string, input: UpdateCommentInput): Promise<Comment | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const payload: Record<string, unknown> = {};
    if (input.commentName !== undefined) payload.comment_name = input.commentName;
    if (input.commentText !== undefined) payload.comment_text = input.commentText;
    if (input.contentFormat !== undefined) payload.content_format = input.contentFormat;
    if (input.commentType !== undefined) payload.comment_type = input.commentType;
    if (input.category !== undefined) payload.category = input.category;
    if (input.recommendation !== undefined) payload.recommendation = input.recommendation;
    if (input.orderIndex !== undefined) payload.order_index = input.orderIndex;
    if (input.defaultValue !== undefined) payload.default_value = input.defaultValue;
    if (input.defaultLocation !== undefined) payload.default_location = input.defaultLocation;
    if (input.locked !== undefined) payload.locked = input.locked;

    const { data, error } = await supabase
      .from("comments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("[CommentRepository.updateComment] Error:", error);
      return null;
    }

    return this.mapDbToDomain(data as DbComment);
  }

  async deleteComment(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      console.error("[CommentRepository.deleteComment] Error:", error);
      return false;
    }
    return true;
  }

  /**
   * Reorder comments within an item
   */
  async reorderComments(itemId: string, orderedCommentIds: string[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const updates = orderedCommentIds.map((id, index) =>
      supabase.from("comments").update({ order_index: index }).eq("id", id).eq("item_id", itemId)
    );

    const results = await Promise.all(updates);
    return results.every((r) => !r.error);
  }

  private mapDbToDomain(d: DbComment): Comment {
    return {
      id: d.id,
      itemId: d.item_id,
      commentName: d.comment_name,
      commentText: d.comment_text,
      contentFormat: (d.content_format || "html") as ContentFormat,
      commentType: d.comment_type,
      category: d.category,
      recommendation: d.recommendation,
      orderIndex: d.order_index,
      answerType: d.answer_type,
      defaultValue: d.default_value,
      defaultValue2: d.default_value_2,
      defaultUnitType: d.default_unit_type,
      defaultLocation: d.default_location,
      defaultEstimateMin: d.default_estimate_min !== null ? Number(d.default_estimate_min) : null,
      defaultEstimateMax: d.default_estimate_max !== null ? Number(d.default_estimate_max) : null,
      locked: Boolean(d.locked),
      simpleFormat: Boolean(d.simple_format),
      disablePhotos: Boolean(d.disable_photos),
      multipleChoiceOptions: d.multiple_choice_options as any,
      unitTypeOptions: d.unit_type_options,
      defaultPhotosAndCaptions: d.default_photos_and_captions as any,
      sourceLastModified: d.source_last_modified,
      sourceMetadata: d.source_metadata,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }
}

export const commentRepository = new CommentRepository();
