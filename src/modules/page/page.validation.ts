import { z } from "zod";
import { localeSchema } from "../../lib/http.js";
import { PAGE_KEYS } from "../../shared/constants.js";

export const pageKey = z.enum(PAGE_KEYS);
export const pageParams = z.object({ key: pageKey, locale: localeSchema });
export const localeQuery = z.object({ locale: localeSchema });

export const pageSchema = z
  .object({ title: z.string().trim().min(1).max(160), body: z.string().max(200_000), status: z.enum(["draft", "published"]) })
  .strict();
export type PageInput = z.infer<typeof pageSchema>;
