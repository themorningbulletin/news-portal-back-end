import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { pageMeta, parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { revalidationTags } from "../article/article.editorial.js";
import { audit } from "../audit/audit.service.js";
import * as media from "./media.service.js";
import { idParams, listMediaQuery, mediaMetaSchema, mediaUploadMeta } from "./media.validation.js";

export function createMediaController(deps: { storage: media.MediaStorage; revalidate: Revalidator }) {
  return {
    async list(req: Request, res: Response) {
      const q = parse(listMediaQuery, req.query);
      const { items, total } = await media.listMedia(q);
      res.json({ data: items, meta: { ...pageMeta(q.page, q.limit, total), uploadsEnabled: deps.storage.enabled() } });
    },

    async get(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      res.json({ data: await media.getMedia(id) });
    },

    /** Runs after multer: the declared type and the file signature must agree. */
    async upload(req: Request, res: Response) {
      if (!req.file) throw new AppError("bad_request", "No file was uploaded");
      const detected = media.detectImageType(req.file.buffer);
      if (!detected || detected !== req.file.mimetype) {
        throw new AppError("unsupported_media_type", "The file content does not match an allowed image type");
      }
      const meta = parse(mediaUploadMeta, req.body ?? {});
      const created = await media.createMedia(deps.storage, req.file.buffer, detected, meta, req.auth!.profile._id);
      await audit(req, { action: "media.upload", entityType: "media", entityId: created.id });
      res.status(201).json({ data: created });
    },

    async update(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const { media: updated, affected } = await media.updateMedia(req.auth!.profile, id, parse(mediaMetaSchema, req.body));
      await audit(req, { action: "media.update", entityType: "media", entityId: String(id) });
      // Captions and credits appear on published stories, so refresh them.
      if (affected.length) await deps.revalidate(affected.flatMap((a) => revalidationTags(a)));
      res.json({ data: updated });
    },
  };
}
