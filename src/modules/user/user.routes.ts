import { Router } from "express";
import type { IdentityProvider } from "../../lib/identity.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { noStore, publicCache } from "../../middleware/cache.js";
import { createUserController } from "./user.controller.js";

type Deps = { identity: IdentityProvider; revalidate: Revalidator };

/** GET /authors, /authors/:slug */
export function authorRoutes(deps: Deps) {
  const c = createUserController(deps);
  const r = Router();
  r.get("/", publicCache(300), c.listAuthors);
  r.get("/:slug", publicCache(300), c.getAuthor);
  return r;
}

/** /me: the signed-in reader's own profile data (authentication and CSRF are applied by the parent router). */
export function meRoutes(deps: Deps) {
  const c = createUserController(deps);
  const r = Router();
  r.patch("/preferences", c.updatePreferences);
  r.get("/follows", c.getFollows);
  r.put("/follows", c.setFollows);
  r.get("/feed", c.feed);
  r.get("/export", c.exportAccount);
  r.delete("/", c.deleteAccount);
  return r;
}

/** /admin/users */
export function adminUserRoutes(deps: Deps) {
  const c = createUserController(deps);
  const r = Router();
  r.use(noStore);
  r.patch("/me/author", requireAuth, c.updateOwnByline);
  r.get("/staff", requirePermission("article:create"), c.staff);
  r.get("/", requirePermission("users:manage"), c.list);
  r.patch("/:id", requirePermission("users:manage"), c.update);
  return r;
}
