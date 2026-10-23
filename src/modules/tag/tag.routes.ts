import { Router } from "express";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createTagController } from "./tag.controller.js";

/** /tags */
export function tagRoutes(deps: { revalidate: Revalidator }) {
  const c = createTagController(deps);
  const r = Router();
  r.get("/", publicCache(300), c.popular);
  r.get("/:slug", publicCache(300), c.getBySlug);
  return r;
}

/** /admin/tags: authors may create tags while writing; editors curate them. */
export function adminTagRoutes(deps: { revalidate: Revalidator }) {
  const c = createTagController(deps);
  const r = Router();
  r.use(noStore);
  r.get("/", requirePermission("article:create"), c.search);
  r.post("/", requirePermission("article:create"), c.create);
  r.patch("/:id", requirePermission("taxonomy:manage"), c.update);
  r.delete("/:id", requirePermission("taxonomy:manage"), c.remove);
  return r;
}
