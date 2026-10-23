import { Router } from "express";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createPageController } from "./page.controller.js";

/** /pages: publisher-written editorial pages (about, policy, corrections, ...). */
export function pageRoutes(deps: { revalidate: Revalidator }) {
  const c = createPageController(deps);
  const r = Router();
  r.get("/", publicCache(300), c.listPublished);
  r.get("/:key", publicCache(300), c.getPublished);
  return r;
}

/** /admin/pages */
export function adminPageRoutes(deps: { revalidate: Revalidator }) {
  const c = createPageController(deps);
  const r = Router();
  r.use(noStore, requirePermission("pages:manage"));
  r.get("/", c.adminList);
  r.get("/:key/:locale", c.adminGet);
  r.put("/:key/:locale", c.save);
  return r;
}
