import type { Request, Response } from "express";
import { parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import * as tags from "./tag.service.js";
import { idParams, localeQuery, popularQuery, searchQuery, slugParam, tagCreateSchema, tagUpdateSchema } from "./tag.validation.js";

export function createTagController(deps: { revalidate: Revalidator }) {
  return {
    async popular(req: Request, res: Response) {
      const q = parse(popularQuery, req.query);
      res.json({ data: await tags.popular(q.locale, q.limit) });
    },

    async getBySlug(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await tags.getBySlug(locale, parse(slugParam, req.params.slug)) });
    },

    async search(req: Request, res: Response) {
      res.json({ data: await tags.search(parse(searchQuery, req.query).q) });
    },

    async create(req: Request, res: Response) {
      const doc = await tags.create(parse(tagCreateSchema, req.body));
      await audit(req, { action: "tag.create", entityType: "tag", entityId: String(doc._id) });
      res.status(201).json({ data: { ...doc.toObject({ versionKey: false }), id: String(doc._id) } });
    },

    async update(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const doc = await tags.update(id, parse(tagUpdateSchema, req.body));
      await audit(req, { action: "tag.update", entityType: "tag", entityId: String(id) });
      await deps.revalidate(["taxonomy", "articles"]);
      res.json({ data: { ...doc.toObject({ versionKey: false }), id: String(doc._id) } });
    },

    async remove(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      await tags.remove(id);
      await audit(req, { action: "tag.delete", entityType: "tag", entityId: String(id) });
      res.status(204).end();
    },
  };
}
