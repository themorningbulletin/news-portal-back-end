import { z } from "zod";
import { localeSchema, objectId } from "../../lib/http.js";
import { slugify, SLUG_PATTERN } from "../../lib/text.js";

export const slugInput = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((s) => slugify(s))
  .refine((s) => SLUG_PATTERN.test(s), "invalid slug");

const localizedRequired = (max: number) => z.object({ bn: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) }).strict();
export const localizedOptional = (max: number) =>
  z.object({ bn: z.string().trim().max(max).optional(), en: z.string().trim().max(max).optional() }).strict();

export const categorySchema = z
  .object({
    name: localizedRequired(80),
    slug: z.object({ bn: slugInput, en: slugInput }).strict(),
    description: localizedOptional(400).optional(),
    parent: objectId.nullable().optional(),
    order: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const categoryUpdateSchema = categorySchema.partial().strict();
export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const localeQuery = z.object({ locale: localeSchema });
export const idParams = z.object({ id: objectId });
export const slugParam = z.string().trim().min(1).max(160).transform((s) => s.normalize("NFC"));
