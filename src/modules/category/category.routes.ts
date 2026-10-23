import { Router } from "express";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createCategoryController } from "./category.controller.js";

/** /categories */
export function categoryRoutes(deps: { revalidate: Revalidator }) {
  const c = createCategoryController(deps);
  const r = Router();
  r.get("/", publicCache(300), c.list);
  r.get("/:slug", publicCache(300), c.getBySlug);
  return r;
}

/** /admin/categories */
export function adminCategoryRoutes(deps: { revalidate: Revalidator }) {
  const c = createCategoryController(deps);
  const r = Router();
  r.use(noStore);
  r.get("/", requirePermission("article:create"), c.adminList);
  r.post("/", requirePermission("taxonomy:manage"), c.create);
  r.patch("/:id", requirePermission("taxonomy:manage"), c.update);
  return r;
}
