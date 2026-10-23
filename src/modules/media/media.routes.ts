import { Router, type RequestHandler } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import { createMediaController } from "./media.controller.js";
import { ALLOWED_IMAGE_TYPES, type MediaStorage } from "./media.service.js";

/** /admin/media */
export function adminMediaRoutes(deps: { storage: MediaStorage; revalidate: Revalidator }) {
  const c = createMediaController(deps);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env().UPLOAD_MAX_BYTES, files: 1, fields: 10, fieldSize: 2000 },
    fileFilter: (_req, file, cb) => {
      if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
      else cb(new AppError("unsupported_media_type", "Only JPEG, PNG, WebP, AVIF or GIF images are accepted"));
    },
  });
  const storageEnabled: RequestHandler = (_req, _res, next) =>
    next(deps.storage.enabled() ? undefined : new AppError("feature_disabled", "Media storage is not configured"));

  const r = Router();
  r.use(noStore, requirePermission("media:upload"));
  r.get("/", c.list);
  r.post("/", storageEnabled, upload.single("file"), c.upload);
  r.get("/:id", c.get);
  r.patch("/:id", c.update);
  return r;
}
