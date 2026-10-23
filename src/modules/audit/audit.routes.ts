import { Router } from "express";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import { auditController as c } from "./audit.controller.js";

/** /admin/audit */
export function adminAuditRoutes() {
  const r = Router();
  r.use(noStore, requirePermission("audit:read"));
  r.get("/", c.list);
  r.get("/:id", c.get);
  return r;
}
