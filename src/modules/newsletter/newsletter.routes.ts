import { Router } from "express";
import type { Mailer } from "../../lib/mailer.js";
import { noStore } from "../../middleware/cache.js";
import type { RateLimiters } from "../../middleware/rate-limit.js";
import { createNewsletterController } from "./newsletter.controller.js";

/** /newsletter */
export function newsletterRoutes(deps: { mailer: Mailer; limiters: RateLimiters }) {
  const c = createNewsletterController(deps);
  const r = Router();
  r.use(noStore, deps.limiters.newsletter);
  r.post("/subscribe", c.subscribe);
  r.post("/confirm", c.confirm);
  r.post("/unsubscribe", c.unsubscribe);
  return r;
}
