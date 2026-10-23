import type { Request, Response } from "express";
import { pageMeta, parse } from "../../lib/http.js";
import * as seo from "./seo.service.js";
import { analyzeSchema, scoresQuery } from "./seo.validation.js";

export const seoController = {
  async overview(_req: Request, res: Response) {
    res.json({ data: await seo.overview() });
  },

  async scores(req: Request, res: Response) {
    const q = parse(scoresQuery, req.query);
    const { items, total } = await seo.listScores(q);
    res.json({ data: items, meta: pageMeta(q.page, q.limit, total) });
  },

  /** Live analysis of the editor's unsaved draft; nothing is stored. */
  async analyze(req: Request, res: Response) {
    res.json({ data: await seo.analyzeDraft(parse(analyzeSchema, req.body)) });
  },
};
