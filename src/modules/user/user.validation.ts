import { z } from "zod";
import { localeSchema, objectId, paginationSchema } from "../../lib/http.js";
import { slugify, SLUG_PATTERN } from "../../lib/text.js";
import { ROLES } from "../../shared/constants.js";

const localizedText = (max: number) =>
  z.object({ bn: z.string().trim().max(max).optional(), en: z.string().trim().max(max).optional() }).strict();

export const authorProfileSchema = z
  .object({
    isPublic: z.boolean().optional(),
    slug: z
      .string()
      .trim()
      .max(80)
      .transform((s) => slugify(s))
      .refine((s) => SLUG_PATTERN.test(s), "invalid slug")
      .optional(),
    name: localizedText(120).optional(),
    bio: localizedText(600).optional(),
    avatarUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).optional(),
  })
  .strict();
export type AuthorProfileInput = z.infer<typeof authorProfileSchema>;

export const listUsersQuery = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    canPublish: z.boolean().optional(),
    disabled: z.boolean().optional(),
    author: authorProfileSchema.optional(),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const preferencesSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]).optional(),
    textSize: z.enum(["sm", "md", "lg", "xl"]).optional(),
    locale: localeSchema.optional(),
  })
  .strict();

export const followsSchema = z
  .object({
    categories: z.array(objectId).max(50).default([]),
    tags: z.array(objectId).max(100).default([]),
  })
  .strict();

export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") }).strict();

export const localeQuery = z.object({ locale: localeSchema });
export const feedQuery = paginationSchema.extend({ locale: localeSchema });
export const idParams = z.object({ id: objectId });
export const slugParam = z.string().trim().min(1).max(160).transform((s) => s.normalize("NFC"));
