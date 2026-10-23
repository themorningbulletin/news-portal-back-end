import type { Request, Response } from "express";
import { z } from "zod";
import { features } from "../../config/env.js";
import { objectId, parse } from "../../lib/http.js";
import type { Mailer } from "../../lib/mailer.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import { HOMEPAGE_VARIANTS } from "./settings.model.js";
import * as settings from "./settings.service.js";

const homepageSchema = z
  .object({ sections: z.array(z.object({ category: objectId, variant: z.enum(HOMEPAGE_VARIANTS) }).strict()).max(12) })
  .strict();

export function createSettingsController(deps: { revalidate: Revalidator; mailer: Mailer }) {
  return {
    /** Public feature flags so the site can hide what is not configured. */
    config(_req: Request, res: Response) {
      res.json({
        data: {
          features: { newsletter: deps.mailer.available(), mediaUploads: features.mediaUploads(), aiAssist: false, comments: false },
        },
      });
    },

    async getHomepage(_req: Request, res: Response) {
      res.json({ data: { sections: await settings.getHomepageSections() } });
    },

    async saveHomepage(req: Request, res: Response) {
      const input = parse(homepageSchema, req.body);
      const sections = await settings.saveHomepageSections(input.sections, req.auth!.profile._id);
      await audit(req, { action: "homepage.update", entityType: "settings", metadata: { sections: sections.map((s) => s.category) } });
      await deps.revalidate(["articles", "settings"]);
      res.json({ data: { sections } });
    },
  };
}
