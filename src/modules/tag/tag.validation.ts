import { z } from "zod";
import { localeSchema, objectId } from "../../lib/http.js";
import { localizedOptional, slugInput } from "../category/category.validation.js";

export const tagCreateSchema = z
  .object({
    name: localizedOptional(60),
    slug: z.object({ bn: slugInput.optional(), en: slugInput.optional() }).strict().optional(),
  })
  .strict()
  .refine((t) => t.name.bn || t.name.en, "a tag needs a name in at least one language");
export type TagCreateInput = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = z
  .object({ name: localizedOptional(60).optional(), slug: z.object({ bn: slugInput.optional(), en: slugInput.optional() }).strict().optional() })
  .strict();
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;

export const popularQuery = z.object({ locale: localeSchema, limit: z.coerce.number().int().min(1).max(50).default(30) });
export const searchQuery = z.object({ q: z.string().trim().max(60).optional() });
export const localeQuery = z.object({ locale: localeSchema });
export const idParams = z.object({ id: objectId });
export const slugParam = z.string().trim().min(1).max(160).transform((s) => s.normalize("NFC"));
