import { z } from "zod";
import { localeSchema, objectId, paginationSchema } from "../../lib/http.js";
import { ARTICLE_FORMATS, ARTICLE_STATUSES } from "../../shared/constants.js";

const VIDEO_HOSTS = ["www.youtube.com", "youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com"];
const optionalText = (max: number) => z.string().trim().max(max).optional();
const nullableDate = z.iso.datetime({ offset: true }).nullable().optional();

export const slugParam = z.string().trim().min(1).max(160).transform((s) => s.normalize("NFC"));
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "invalid date");
export const idParams = z.object({ id: objectId });
export const localeQuery = z.object({ locale: localeSchema });

/* ---------------- Public ---------------- */

export const listQuery = paginationSchema.extend({
  locale: localeSchema,
  category: slugParam.optional(),
  tag: slugParam.optional(),
  author: slugParam.optional(),
  format: z.enum(ARTICLE_FORMATS).optional(),
  date: dateString.optional(),
});

export const popularQuery = z.object({ locale: localeSchema, limit: z.coerce.number().int().min(1).max(20).default(10) });
export const viewBody = z.object({ referrer: z.string().max(2000).optional() }).strict();

export const searchQuery = paginationSchema.extend({
  locale: localeSchema,
  q: z.string().trim().min(2).max(100),
  category: slugParam.optional(),
  author: slugParam.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
export const suggestQuery = z.object({ locale: localeSchema, q: z.string().trim().min(2).max(100) });

export const archiveParams = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
export const sitemapQuery = z.object({
  locale: localeSchema,
  page: z.coerce.number().int().min(1).max(1000).default(1),
  since: z.iso.datetime().optional(),
});

/* ---------------- Newsroom ---------------- */

export const articleFields = z
  .object({
    title: z.string().trim().min(1).max(220),
    slug: z.string().trim().max(120).optional(),
    summary: optionalText(400),
    body: z.string().max(300_000).optional(),
    format: z.enum(ARTICLE_FORMATS).optional(),
    category: objectId.nullable().optional(),
    tags: z.array(objectId).max(20).optional(),
    authors: z.array(objectId).min(1).max(10).optional(),
    featuredImage: objectId.nullable().optional(),
    imageAlt: optionalText(300),
    imageCaption: optionalText(500),
    imageCredit: optionalText(200),
    videoUrl: z
      .union([
        z.literal(""),
        z.url({ protocol: /^https$/ }).refine((u) => VIDEO_HOSTS.includes(new URL(u).hostname), "only YouTube or Vimeo links"),
      ])
      .optional(),
    seo: z
      .object({
        title: optionalText(120),
        description: optionalText(320),
        canonicalUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
        socialImage: objectId.nullable().optional(),
        focusKeyword: optionalText(80),
      })
      .strict()
      .optional(),
    isFeatured: z.boolean().optional(),
    isEditorsPick: z.boolean().optional(),
    pinnedUntil: nullableDate,
    breakingUntil: nullableDate,
  })
  .strict();
export type ArticleFieldsInput = Partial<z.infer<typeof articleFields>>;

export const createArticleSchema = articleFields.extend({ locale: localeSchema, translationOf: objectId.optional() }).strict();
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = articleFields
  .partial()
  .extend({
    version: z.number().int().min(1),
    revision: z.enum(["manual", "autosave"]).default("manual"),
    markUpdated: z.boolean().optional(),
  })
  .strict();
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const TRANSITIONS = ["submit", "withdraw", "publish", "schedule", "unschedule", "unpublish", "archive", "restore"] as const;
export const transitionSchema = z
  .object({
    action: z.enum(TRANSITIONS),
    version: z.number().int().min(1),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const adminListQuery = paginationSchema.extend({
  status: z.enum(ARTICLE_STATUSES).optional(),
  locale: localeSchema.optional(),
  category: objectId.optional(),
  q: z.string().trim().max(100).optional(),
  mine: z.enum(["true", "false"]).optional(),
  sort: z.enum(["updated", "published", "scheduled"]).default("updated"),
});

export const calendarQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const noteSchema = z.object({ text: z.string().trim().min(1).max(2000) }).strict();
export const revisionParams = z.object({ id: objectId, revisionId: objectId });
export const versionSchema = z.object({ version: z.number().int().min(1) }).strict();
export const bulkSchema = z
  .object({
    ids: z.array(objectId).min(1).max(50),
    action: z.enum(["submit", "unpublish", "archive"]),
    confirm: z.literal(true),
  })
  .strict();
