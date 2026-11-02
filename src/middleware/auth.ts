import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import type { IdentityProvider } from "../lib/identity.js";
import { hasPermission, type Permission } from "../lib/permissions.js";
import { ensureRolesLoaded } from "../modules/role/role.service.js";
import { UserProfile } from "../modules/user/user.model.js";

const isProd = () => env().NODE_ENV === "production";

// The __Host- prefix forces Secure, Path=/ and no Domain, so subdomains cannot plant cookies.
export const SESSION_COOKIE = () => (isProd() ? "__Host-khoka_session" : "khoka_session");
export const CSRF_COOKIE = () => (isProd() ? "__Host-khoka_csrf" : "khoka_csrf");

const baseCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax",
  path: "/",
});

export function setSessionCookie(res: Response, value: string, maxAgeMs: number) {
  res.cookie(SESSION_COOKIE(), value, { ...baseCookie(), maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE(), baseCookie());
}

export function issueCsrfToken(res: Response): string {
  const token = randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE(), token, { ...baseCookie(), sameSite: "strict", maxAge: 24 * 60 * 60 * 1000 });
  return token;
}

/**
 * Resolves the caller's identity from a Bearer ID token or the session cookie.
 * Never fails the request by itself; requireAuth decides.
 */
export function authenticate(identity: IdentityProvider): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    const cookie: unknown = req.cookies?.[SESSION_COOKIE()];
    const sessionCookie = typeof cookie === "string" && cookie.length > 0 ? cookie : undefined;
    if (!bearer && !sessionCookie) return next();

    try {
      const via = bearer ? "bearer" : "cookie";
      const id = bearer ? await identity.verifyIdToken(bearer) : await identity.verifySessionCookie(sessionCookie!);
      let profile = await UserProfile.findOne({ firebaseUid: id.uid });
      if (!profile) {
        // First contact: every new identity starts as a reader. Roles are only granted by admins.
        profile = await UserProfile.create({ firebaseUid: id.uid, email: id.email, displayName: id.name });
      }
      await ensureRolesLoaded();
      req.auth = { identity: id, profile, via };
    } catch {
      // Invalid credentials are treated as anonymous; protected routes answer 401.
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError("unauthenticated", "Sign in to continue"));
  if (req.auth.profile.disabled) return next(new AppError("forbidden", "This account is disabled"));
  next();
};

export function requirePermission(...anyOf: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError("unauthenticated", "Sign in to continue"));
    if (req.auth.profile.disabled) return next(new AppError("forbidden", "This account is disabled"));
    if (!anyOf.some((permission) => hasPermission(req.auth!.profile.role, permission))) {
      return next(new AppError("forbidden", "You do not have permission to perform this action"));
    }
    next();
  };
}

/** Double-submit CSRF check for cookie-authenticated, state-changing requests. */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.auth?.via === "bearer") return next();
  const header = req.get("x-csrf-token") ?? "";
  const raw: unknown = req.cookies?.[CSRF_COOKIE()];
  const cookie = typeof raw === "string" ? raw : "";
  const a = Buffer.from(header);
  const b = Buffer.from(cookie);
  if (!cookie || a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new AppError("csrf_failed", "Missing or invalid CSRF token"));
  }
  next();
};
