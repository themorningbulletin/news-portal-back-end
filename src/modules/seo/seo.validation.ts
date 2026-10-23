import { z } from "zod";
import { localeSchema, objectId, paginationSchema } from "../../lib/http.js";

export const analyzeSchema = z
  .object({
    id: objectId.optional(),
    locale: localeSchema,
    title: z.string().max(220),
    slug: z.string().max(160),
    summary: z.string().max(400).optional(),
    body: z.string().max(300_000).optional(),
    seo: z
      .object({
        title: z.string().max(120).optional(),
        description: z.string().max(320).optional(),
        canonicalUrl: z.string().max(500).optional(),
        focusKeyword: z.string().max(80).optional(),
      })
      .strict()
      .optional(),
    featuredImage: objectId.nullable().optional(),
    imageAlt: z.string().max(300).optional(),
    tags: z.array(objectId).max(20).optional(),
    category: objectId.nullable().optional(),
  })
  .strict();

export const scoresQuery = paginationSchema.extend({
  locale: localeSchema.optional(),
  issue: z.string().regex(/^[a-z_]{2,40}$/).optional(),
  grade: z.enum(["good", "fair", "poor"]).optional(),
  sort: z.enum(["score", "recent"]).default("score"),
});
