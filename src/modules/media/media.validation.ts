import { z } from "zod";
import { objectId, paginationSchema } from "../../lib/http.js";

export const mediaMetaSchema = z
  .object({
    alt: z.object({ bn: z.string().max(300).optional(), en: z.string().max(300).optional() }).strict().optional(),
    caption: z.object({ bn: z.string().max(500).optional(), en: z.string().max(500).optional() }).strict().optional(),
    credit: z.string().max(200).optional(),
    focalX: z.number().min(0).max(100).optional(),
    focalY: z.number().min(0).max(100).optional(),
  })
  .strict();
export type MediaMetaInput = z.infer<typeof mediaMetaSchema>;

/** Multipart text fields sent with an upload. */
export const mediaUploadMeta = z.object({
  alt_bn: z.string().max(300).optional(),
  alt_en: z.string().max(300).optional(),
  caption_bn: z.string().max(500).optional(),
  caption_en: z.string().max(500).optional(),
  credit: z.string().max(200).optional(),
});
export type MediaUploadMeta = z.infer<typeof mediaUploadMeta>;

export const listMediaQuery = paginationSchema.extend({ q: z.string().trim().max(100).optional() });
export const idParams = z.object({ id: objectId });
