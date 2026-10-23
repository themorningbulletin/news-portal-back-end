import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("not_found", "Route not found"));
};

function normalize(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    return err.code === "LIMIT_FILE_SIZE"
      ? new AppError("payload_too_large", "File is too large")
      : new AppError("bad_request", "Invalid upload");
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return new AppError(
      "validation_failed",
      "The data did not pass validation",
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    );
  }
  if (err instanceof mongoose.Error.CastError) return new AppError("bad_request", "Malformed identifier or value");
  if (err && typeof err === "object") {
    const e = err as { code?: number; type?: string; keyValue?: Record<string, unknown> };
    if (e.code === 11000) {
      return new AppError("conflict", "A record with the same unique value already exists", {
        fields: Object.keys(e.keyValue ?? {}),
      });
    }
    if (e.type === "entity.too.large") return new AppError("payload_too_large", "Request body is too large");
    if (e.type === "entity.parse.failed") return new AppError("bad_request", "Malformed JSON body");
  }
  return new AppError("internal", "Something went wrong");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = normalize(err);
  if (appErr.status >= 500) {
    logger.error({ err, requestId: req.id, path: req.path }, "request failed");
  }
  if (res.headersSent) return;
  res.status(appErr.status).json({
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details !== undefined ? { details: appErr.details } : {}),
      requestId: req.id,
    },
  });
};
