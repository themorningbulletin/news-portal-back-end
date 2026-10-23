import { Router } from "express";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import { seoController as c } from "./seo.controller.js";

/** /admin/seo */
export function adminSeoRoutes() {
  const r = Router();
  r.use(noStore);
  // Every writer can check their own draft; the site-wide audit is for editors.
  r.post("/analyze", requirePermission("article:create"), c.analyze);
  r.get("/overview", requirePermission("article:edit_any"), c.overview);
  r.get("/articles", requirePermission("article:edit_any"), c.scores);
  return r;
}
