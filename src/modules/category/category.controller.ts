import type { Request, Response } from "express";
import { parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import * as categories from "./category.service.js";
import { categorySchema, categoryUpdateSchema, idParams, localeQuery, slugParam } from "./category.validation.js";

export function createCategoryController(deps: { revalidate: Revalidator }) {
  const refresh = () => deps.revalidate(["taxonomy", "articles"]);
  return {
    async list(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await categories.listActive(locale) });
    },

    async getBySlug(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await categories.getDetail(locale, parse(slugParam, req.params.slug)) });
    },

    async adminList(_req: Request, res: Response) {
      res.json({ data: await categories.listAllWithCounts() });
    },

    async create(req: Request, res: Response) {
      const doc = await categories.create(parse(categorySchema, req.body));
      await audit(req, { action: "category.create", entityType: "category", entityId: String(doc._id), summary: doc.name.en });
      await refresh();
      res.status(201).json({ data: { ...doc.toObject({ versionKey: false }), id: String(doc._id) } });
    },

    async update(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const doc = await categories.update(id, parse(categoryUpdateSchema, req.body));
      await audit(req, { action: "category.update", entityType: "category", entityId: String(id) });
      await refresh();
      res.json({ data: { ...doc.toObject({ versionKey: false }), id: String(doc._id) } });
    },
  };
}
