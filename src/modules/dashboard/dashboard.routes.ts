import { Router } from "express";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import { dashboardController as c } from "./dashboard.controller.js";

/** /admin/dashboard */
export function adminDashboardRoutes() {
  const r = Router();
  r.get("/", noStore, requirePermission("dashboard:read"), c.get);
  return r;
}
