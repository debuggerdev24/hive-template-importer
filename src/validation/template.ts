import { z } from "zod";

export const updateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").max(200),
  orderIndex: z.number().int().nonnegative().optional(),
});

export const updateItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  orderIndex: z.number().int().nonnegative().optional(),
});

export const updateCommentSchema = z.object({
  commentName: z.string().max(200).optional().nullable(),
  commentText: z.string().optional().nullable(),
  contentFormat: z.enum(["html", "plain_text", "markdown"]).optional(),
  commentType: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  recommendation: z.string().max(2000).optional().nullable(),
  orderIndex: z.number().int().nonnegative().optional(),
  defaultValue: z.string().optional().nullable(),
  defaultLocation: z.string().optional().nullable(),
  locked: z.boolean().optional(),
});

export const batchSectionUpdateSchema = updateSectionSchema.extend({
  id: z.string().min(1, "Section ID is required"),
});

export const batchItemUpdateSchema = updateItemSchema.extend({
  id: z.string().min(1, "Item ID is required"),
});

export const batchCommentUpdateSchema = updateCommentSchema.extend({
  id: z.string().min(1, "Comment ID is required"),
});

export const batchUpdateSchema = z.object({
  templateName: z.string().min(1, "Template name cannot be empty").max(200).optional(),
  templateDescription: z.string().max(1000).optional().nullable(),
  sections: z.array(batchSectionUpdateSchema).optional(),
  items: z.array(batchItemUpdateSchema).optional(),
  comments: z.array(batchCommentUpdateSchema).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type BatchSectionUpdateInput = z.infer<typeof batchSectionUpdateSchema>;
export type BatchItemUpdateInput = z.infer<typeof batchItemUpdateSchema>;
export type BatchCommentUpdateInput = z.infer<typeof batchCommentUpdateSchema>;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

