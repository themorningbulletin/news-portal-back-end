import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { rateLimit, type Options } from "express-rate-limit";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

/** Read-only requests from the site's own server carry a shared key and skip the per-IP API budget. */
export function isTrustedInternal(req: Request): boolean {
  const key = env().INTERNAL_API_KEY;
  const sent = req.get("x-internal-key");
  if (!key || !sent || !["GET", "HEAD"].includes(req.method)) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RateLimitConfig {
  api: number;
  search: number;
  auth: number;
  write: number;
  newsletter: number;
  views: number;
}

export const defaultRateLimits: RateLimitConfig = {
  api: 600,
  search: 60,
  auth: 30,
  write: 120,
  newsletter: 5,
  views: 120,
};

const make = (windowMs: number, limit: number, extra: Partial<Options> = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError("rate_limited", "Too many requests, please slow down")),
    ...extra,
  });

/**
 * In-memory stores are per process. When running several API instances, plug
 * a shared store (e.g. Redis) into these limiters; see docs/SECURITY.md.
 */
export function createRateLimiters(cfg: RateLimitConfig) {
  return {
    api: make(60_000, cfg.api, { skip: isTrustedInternal }),
    search: make(60_000, cfg.search),
    auth: make(15 * 60_000, cfg.auth),
    write: make(60_000, cfg.write, { skip: (req) => req.method === "GET" || req.method === "HEAD" }),
    newsletter: make(60 * 60_000, cfg.newsletter),
    views: make(60_000, cfg.views),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
