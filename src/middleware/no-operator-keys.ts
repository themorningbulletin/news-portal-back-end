import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";

/**
 * Defence in depth against NoSQL operator injection: request bodies and query
 * strings may never contain keys that start with "$" or contain ".".
 * (Every route also validates its input with a strict Zod schema.)
 */
function hasOperatorKey(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (Array.isArray(value)) return value.some((v) => hasOperatorKey(v, depth + 1));
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".") || key === "__proto__" || key === "constructor") return true;
      if (hasOperatorKey(v, depth + 1)) return true;
    }
  }
  return false;
}

export const noOperatorKeys: RequestHandler = (req, _res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
    next(new AppError("bad_request", "Request contains disallowed keys"));
    return;
  }
  next();
};
