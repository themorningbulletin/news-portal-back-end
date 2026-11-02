import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { pageMeta, parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import type { MediaStorage } from "../media/media.service.js";
import * as admin from "./article.admin.service.js";
import { revalidationTags } from "./article.editorial.js";
import {
  adminListQuery,
  bulkSchema,
  calendarQuery,
  createArticleSchema,
  idParams,
  noteSchema,
  revisionParams,
  transitionSchema,
  updateArticleSchema,
  versionSchema,
} from "./article.validation.js";

/** Newsroom (CMS) article endpoints. Every action is permission-checked in the service layer. */
export function createArticleAdminController(deps: { revalidate: Revalidator; storage: MediaStorage }) {
  return {
    async list(req: Request, res: Response) {
      const q = parse(adminListQuery, req.query);
      const { docs, total } = await admin.listForNewsroom(req.auth!.profile, q);
      res.json({ data: docs, meta: pageMeta(q.page, q.limit, total) });
    },

    async create(req: Request, res: Response) {
      const user = req.auth!.profile;
      const article = await admin.createArticle(user, parse(createArticleSchema, req.body));
      await audit(req, { action: "article.create", entityType: "article", entityId: String(article._id), summary: article.title });
      res.status(201).json({ data: await admin.adminView(article, user) });
    },

    async get(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const user = req.auth!.profile;
      res.json({ data: await admin.adminView(await admin.loadForUser(user, id), user) });
    },

    async update(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const user = req.auth!.profile;
      const { updated, oldSlug, slugChanged, revision } = await admin.updateArticle(user, id, parse(updateArticleSchema, req.body));
      if (revision === "manual") {
        await audit(req, {
          action: "article.update",
          entityType: "article",
          entityId: String(updated._id),
          summary: updated.title,
          metadata: slugChanged ? { slugChangedFrom: oldSlug } : undefined,
        });
      }
      if (updated.status === "published") await deps.revalidate(revalidationTags(updated, [oldSlug]));
      res.json({ data: await admin.adminView(updated, user) });
    },

    async remove(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const { article, wasPublic, images } = await admin.deleteArticle(req.auth!.profile, id, deps.storage);
      await audit(req, { action: "article.delete", entityType: "article", entityId: String(id), summary: article.title, metadata: { images } });
      if (wasPublic) await deps.revalidate(revalidationTags(article));
      res.json({ data: { deleted: true, images } });
    },

    async transition(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const input = parse(transitionSchema, req.body);
      const user = req.auth!.profile;
      const { updated, wasPublic } = await admin.transitionArticle(user, id, input);
      await audit(req, {
        action: `article.${input.action}`,
        entityType: "article",
        entityId: String(updated._id),
        summary: updated.title,
        metadata: input.scheduledFor ? { scheduledFor: input.scheduledFor } : undefined,
      });
      if (wasPublic || updated.status === "published") await deps.revalidate(revalidationTags(updated));
      res.json({ data: await admin.adminView(updated, user) });
    },

    async addNote(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const { text } = parse(noteSchema, req.body);
      const user = req.auth!.profile;
      res.status(201).json({ data: await admin.adminView(await admin.addNote(user, id, text), user) });
    },

    async revisions(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      res.json({ data: await admin.listRevisions(req.auth!.profile, id) });
    },

    async restoreRevision(req: Request, res: Response) {
      const { id, revisionId } = parse(revisionParams, req.params);
      const { version } = parse(versionSchema, req.body);
      const user = req.auth!.profile;
      const updated = await admin.restoreRevision(user, id, revisionId, version);
      await audit(req, { action: "article.restore_revision", entityType: "article", entityId: String(updated._id), metadata: { revision: String(revisionId) } });
      if (updated.status === "published") await deps.revalidate(revalidationTags(updated));
      res.json({ data: await admin.adminView(updated, user) });
    },

    async calendar(req: Request, res: Response) {
      const q = parse(calendarQuery, req.query);
      res.json({ data: await admin.calendar(req.auth!.profile, q.year, q.month) });
    },

    async duplicate(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const user = req.auth!.profile;
      const copy = await admin.duplicateArticle(user, id);
      await audit(req, { action: "article.duplicate", entityType: "article", entityId: String(copy._id), metadata: { from: String(id) } });
      res.status(201).json({ data: await admin.adminView(copy, user) });
    },

    async endBreaking(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const updated = await admin.endBreaking(req.auth!.profile, id);
      await audit(req, { action: "article.end_breaking", entityType: "article", entityId: String(id), summary: updated.title });
      if (updated.status === "published") await deps.revalidate(revalidationTags(updated));
      res.status(204).end();
    },

    /** Bulk actions are permission-checked per story and must be explicitly confirmed. */
    async bulk(req: Request, res: Response) {
      const input = parse(bulkSchema, req.body);
      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const id of input.ids) {
        try {
          const { updated, wasPublic } = await admin.bulkTransitionOne(req.auth!.profile, id, input.action);
          await audit(req, { action: `article.${input.action}`, entityType: "article", entityId: String(id), metadata: { bulk: true } });
          if (wasPublic) await deps.revalidate(revalidationTags(updated));
          results.push({ id: String(id), ok: true });
        } catch (err) {
          results.push({ id: String(id), ok: false, error: err instanceof AppError ? err.code : "internal" });
        }
      }
      res.json({ data: results });
    },
  };
}
