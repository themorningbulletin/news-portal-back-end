import { z } from "zod";
import { localeSchema } from "../../lib/http.js";

export const subscribeSchema = z
  .object({
    email: z.email().max(254).transform((e) => e.toLowerCase()),
    locale: localeSchema,
    /** Honeypot: real people never fill this hidden field. */
    website: z.string().max(200).optional(),
  })
  .strict();

export const tokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }).strict();
