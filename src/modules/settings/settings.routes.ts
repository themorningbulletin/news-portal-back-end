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
  r.use(noStore);
  r.get("/homepage", requirePermission("homepage:manage"), c.getHomepage);
  r.put("/homepage", requirePermission("homepage:manage"), c.saveHomepage);
  // Social links live in the footer next to the information pages.
  r.get("/social", requirePermission("pages:manage", "homepage:manage"), c.getSocial);
  r.put("/social", requirePermission("pages:manage", "homepage:manage"), c.saveSocial);
  return r;
}
