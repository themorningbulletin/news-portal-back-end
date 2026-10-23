import { Router } from "express";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createAdController } from "./ad.controller.js";

/** /ads */
export function adRoutes(deps: { revalidate: Revalidator }) {
  const r = Router();
  r.get("/placements", publicCache(300), createAdController(deps).publicList);
  return r;
}

/** /admin/ads */
export function adminAdRoutes(deps: { revalidate: Revalidator }) {
  const c = createAdController(deps);
  const r = Router();
  r.use(noStore, requirePermission("ads:manage"));
  r.get("/", c.adminList);
  r.put("/:key", c.save);
  return r;
}
