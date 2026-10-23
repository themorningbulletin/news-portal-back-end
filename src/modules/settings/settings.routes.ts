import { Router } from "express";
import type { Mailer } from "../../lib/mailer.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createSettingsController } from "./settings.controller.js";

type Deps = { revalidate: Revalidator; mailer: Mailer };

/** GET /config */
export function configRoutes(deps: Deps) {
  const r = Router();
  r.get("/", publicCache(300), createSettingsController(deps).config);
  return r;
}

/** /admin/settings */
export function adminSettingsRoutes(deps: Deps) {
  const c = createSettingsController(deps);
  const r = Router();
  r.use(noStore, requirePermission("homepage:manage"));
  r.get("/homepage", c.getHomepage);
  r.put("/homepage", c.saveHomepage);
  return r;
}
