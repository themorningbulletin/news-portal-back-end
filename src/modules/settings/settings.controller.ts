import type { Request, Response } from "express";
import { z } from "zod";
import { features } from "../../config/env.js";
import { objectId, parse } from "../../lib/http.js";
import type { Mailer } from "../../lib/mailer.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import { HOMEPAGE_KINDS, HOMEPAGE_VARIANTS, HOMEPAGE_WIDTHS, SOCIAL_KEYS } from "./settings.model.js";
import * as settings from "./settings.service.js";

const homepageSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            kind: z.enum(HOMEPAGE_KINDS).default("section"),
            category: objectId.nullable().optional(),
            variant: z.enum(HOMEPAGE_VARIANTS).default("grid"),
            width: z
              .number()
              .int()
              .refine((w) => (HOMEPAGE_WIDTHS as readonly number[]).includes(w), "width must be 12, 9, 8, 6, 4, 3 or 2")
              .default(12),
            count: z.number().int().min(1).max(12).nullable().optional(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();

/** Only https links (a profile page, or a wa.me / t.me link). */
const socialUrl = z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(300)]);
const socialSchema = z.object(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, socialUrl.optional()]))).strict();

export function createSettingsController(deps: { revalidate: Revalidator; mailer: Mailer }) {
  return {
    /** Public feature flags (so the site can hide what is not configured) and the footer's social links. */
    async config(_req: Request, res: Response) {
      res.json({
        data: {
          features: { newsletter: deps.mailer.available(), mediaUploads: features.mediaUploads(), aiAssist: false, comments: false },
          social: await settings.getSocialLinks(),
        },
      });
    },

    async getHomepage(_req: Request, res: Response) {
      res.json({ data: await settings.getHomepageSections() });
    },

    async saveHomepage(req: Request, res: Response) {
      const input = parse(homepageSchema, req.body);
      const sections = await settings.saveHomepageSections(
        input.sections.map((s) => ({ ...s, category: s.category ?? null, width: s.width as (typeof HOMEPAGE_WIDTHS)[number] })),
        req.auth!.profile._id,
      );
      await audit(req, { action: "homepage.update", entityType: "settings", metadata: { sections: sections.map((s) => s.category ?? "ad") } });
      await deps.revalidate(["articles", "settings"]);
      res.json({ data: { sections } });
    },

    async getSocial(_req: Request, res: Response) {
      res.json({ data: await settings.getSocialLinks() });
    },

    async saveSocial(req: Request, res: Response) {
      const input = parse(socialSchema, req.body) as Record<(typeof SOCIAL_KEYS)[number], string | undefined>;
      const social = await settings.saveSocialLinks(input, req.auth!.profile._id);
      await audit(req, { action: "social.update", entityType: "settings" });
      await deps.revalidate(["settings"]);
      res.json({ data: social });
    },
  };
}
