import type { RequestHandler } from "express";

/** Public responses are identical for everyone, so shared caches may keep them briefly. */
export const publicCache =
  (seconds = 60): RequestHandler =>
  (_req, res, next) => {
    // No s-maxage: a shared CDN copy would hand stale data to the site right after a revalidation webhook.
    res.set("Cache-Control", `public, max-age=${Math.min(seconds, 60)}`);
    next();
  };

/** Personal or editorial data must never be stored by a shared cache. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};
