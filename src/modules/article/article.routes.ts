import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import type { RateLimiters } from "../../middleware/rate-limit.js";
import type { MediaStorage } from "../media/media.service.js";
import { createArticleAdminController } from "./article.admin.controller.js";
import { articleController as c } from "./article.controller.js";
import { schedulerTick } from "./article.scheduler.js";

/** Public reading endpoints: /homepage, /articles, /search, /archive, /sitemap. */
export function articleRoutes(deps: { limiters: RateLimiters }) {
  const r = Router();
  r.get("/homepage", publicCache(), c.homepage);
  r.get("/articles", publicCache(), c.list);
  r.get("/articles/popular", publicCache(), c.popular);
  r.get("/articles/breaking", publicCache(30), c.breaking);
  r.get("/articles/by-slug/:slug", publicCache(), c.bySlug);
  r.get("/articles/:id/related", publicCache(), c.related);
  r.post("/articles/:id/view", deps.limiters.views, c.view);
  r.get("/search", deps.limiters.search, c.search);
  r.get("/search/suggest", deps.limiters.search, c.suggest);
  r.get("/archive/:year/:month", publicCache(300), c.archive);
  r.get("/sitemap/articles", publicCache(600), c.sitemap);
  return r;
}

/** /admin/articles */
export function adminArticleRoutes(deps: { revalidate: Revalidator; storage: MediaStorage }) {
  const a = createArticleAdminController(deps);
  const r = Router();
  r.use(noStore, requirePermission("article:create"));
  r.get("/", a.list);
  r.post("/", a.create);
  r.post("/bulk", a.bulk);
  r.get("/calendar", a.calendar);
  r.get("/:id", a.get);
  r.patch("/:id", a.update);
  r.delete("/:id", a.remove);
  r.post("/:id/transition", a.transition);
  r.post("/:id/notes", a.addNote);
  r.post("/:id/duplicate", a.duplicate);
  r.post("/:id/end-breaking", a.endBreaking);
  r.get("/:id/revisions", a.revisions);
  r.post("/:id/revisions/:revisionId/restore", a.restoreRevision);
  return r;
}

/** /internal/cron: for hosts without a long-running process. Only a matching CRON_SECRET may trigger it. */
export function cronRoutes(deps: { revalidate: Revalidator }) {
  const r = Router();
  r.get("/scheduler", noStore, async (req, res) => {
    const secret = env().CRON_SECRET;
    const a = Buffer.from(req.get("authorization") ?? "");
    const b = Buffer.from(`Bearer ${secret}`);
    if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("unauthenticated", "Invalid cron secret");
    const now = new Date();
    const published = await schedulerTick(deps.revalidate, new Date(now.getTime() - 10 * 60_000), now);
    res.json({ data: { published } });
  });
  return r;
}
