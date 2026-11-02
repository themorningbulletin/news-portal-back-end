import type { Request, Response } from "express";
import { pageMeta, parse } from "../../lib/http.js";
import type { IdentityProvider } from "../../lib/identity.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { clearSessionCookie } from "../../middleware/auth.js";
import { followedFeed } from "../article/article.service.js";
import { audit } from "../audit/audit.service.js";
import { serializeMe, withId } from "./user.serializer.js";
import * as users from "./user.service.js";
import {
  authorProfileSchema,
  deleteAccountSchema,
  feedQuery,
  followsSchema,
  idParams,
  listUsersQuery,
  localeQuery,
  preferencesSchema,
  slugParam,
  inviteUserSchema,
  updateUserSchema,
} from "./user.validation.js";

export function createUserController(deps: { identity: IdentityProvider; revalidate: Revalidator }) {
  return {
    /* ---- public bylines ---- */
    async listAuthors(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await users.listPublicAuthors(locale) });
    },

    async getAuthor(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await users.getPublicAuthor(locale, parse(slugParam, req.params.slug)) });
    },

    /* ---- admin ---- */
    async list(req: Request, res: Response) {
      const q = parse(listUsersQuery, req.query);
      const { docs, total } = await users.listUsers(q);
      res.json({ data: docs.map(withId), meta: pageMeta(q.page, q.limit, total) });
    },

    async staff(_req: Request, res: Response) {
      res.json({ data: (await users.listStaff()).map(withId) });
    },

    async update(req: Request, res: Response) {
      const { id } = parse(idParams, req.params);
      const input = parse(updateUserSchema, req.body);
      const { before, updated } = await users.updateUser(req.auth!.profile, id, input);
      await audit(req, {
        action: "user.update",
        entityType: "user",
        entityId: String(id),
        metadata: { from: before, to: { role: input.role, canPublish: input.canPublish, disabled: input.disabled } },
      });
      if (input.author) await deps.revalidate(["authors", "articles"]);
      res.json({ data: withId(updated) });
    },

    async invite(req: Request, res: Response) {
      const input = parse(inviteUserSchema, req.body);
      const { user, created, resetLink } = await users.inviteUser(req.auth!.profile, deps.identity, input);
      const id = String(user._id);
      await audit(req, { action: "user.invite", entityType: "user", entityId: id, metadata: { role: input.role, created } });
      res.status(201).json({ data: { user: withId(user), created, resetLink } });
    },

    async updateOwnByline(req: Request, res: Response) {
      const input = parse(authorProfileSchema, req.body);
      const updated = await users.updateOwnByline(req.auth!.profile, input);
      await audit(req, { action: "user.author_profile", entityType: "user", entityId: String(req.auth!.profile._id) });
      await deps.revalidate(["authors", "articles"]);
      res.json({ data: withId(updated) });
    },

    /* ---- reader self-service (/me) ---- */
    async updatePreferences(req: Request, res: Response) {
      const prefs = parse(preferencesSchema, req.body);
      res.json({ data: serializeMe(await users.updatePreferences(req.auth!.profile, prefs)) });
    },

    async getFollows(req: Request, res: Response) {
      const { locale } = parse(localeQuery, req.query);
      res.json({ data: await users.getFollows(req.auth!.profile, locale) });
    },

    async setFollows(req: Request, res: Response) {
      const input = parse(followsSchema, req.body);
      res.json({ data: serializeMe(await users.setFollows(req.auth!.profile, input)) });
    },

    async feed(req: Request, res: Response) {
      const q = parse(feedQuery, req.query);
      const { items, total } = await followedFeed(req.auth!.profile, q.locale, q.page, q.limit);
      res.json({ data: items, meta: pageMeta(q.page, q.limit, total) });
    },

    async exportAccount(req: Request, res: Response) {
      res.setHeader("Content-Disposition", 'attachment; filename="morning-bulletin-account.json"');
      res.json(await users.exportAccount(req.auth!.profile));
    },

    async deleteAccount(req: Request, res: Response) {
      parse(deleteAccountSchema, req.body);
      const profile = req.auth!.profile;
      await users.deleteAccount(profile, deps.identity);
      await audit(req, { action: "account.delete", entityType: "user", entityId: String(profile._id) });
      clearSessionCookie(res);
      res.status(204).end();
    },
  };
}
