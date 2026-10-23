import type { Request, Response } from "express";
import { parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import * as pages from "./page.service.js";
import { localeQuery, pageKey, pageParams, pageSchema } from "./page.validation.js";

export function createPageController(deps: { revalidate: Revalidator }) {
  return {
    async getPublished(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await pages.getPublished(parse(pageKey, req.params.key), locale) });
    },

    async listPublished(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await pages.listPublished(locale) });
    },

    async adminList(_req: Request, res: Response) {
      res.json({ data: await pages.listAll() });
    },

    async adminGet(req: Request, res: Response) {
      const p = parse(pageParams, req.params);
      res.json({ data: await pages.getForEditing(p.key, p.locale) });
    },

    async save(req: Request, res: Response) {
      const p = parse(pageParams, req.params);
      const input = parse(pageSchema, req.body);
      const doc = await pages.save(p.key, p.locale, input, req.auth!.profile._id);
      await audit(req, { action: "page.update", entityType: "page", entityId: `${p.key}:${p.locale}`, metadata: { status: input.status } });
      await deps.revalidate(["pages"]);
      res.json({ data: doc });
    },
  };
}
