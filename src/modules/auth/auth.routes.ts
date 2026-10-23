import { Router } from "express";
import type { IdentityProvider } from "../../lib/identity.js";
import { requireAuth, requireCsrf } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import type { RateLimiters } from "../../middleware/rate-limit.js";
import { createAuthController } from "./auth.controller.js";

/** /auth */
export function authRoutes(deps: { identity: IdentityProvider; limiters: RateLimiters }) {
  const c = createAuthController(deps);
  const r = Router();
  r.use(noStore);
  r.get("/csrf", c.csrf);
  r.post("/session", deps.limiters.auth, requireCsrf, c.session);
  r.post("/logout", requireCsrf, c.logout);
  r.get("/me", requireAuth, c.me);
  return r;
}
