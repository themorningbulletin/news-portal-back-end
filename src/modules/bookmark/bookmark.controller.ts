import type { Request, Response } from "express";
import { z } from "zod";
import { localeSchema, objectId, pageMeta, paginationSchema, parse } from "../../lib/http.js";
import * as bookmarks from "./bookmark.service.js";

const groupParams = z.object({ group: objectId });
const listQuery = paginationSchema.extend({ locale: localeSchema });

export const bookmarkController = {
  async ids(req: Request, res: Response) {
    res.json({ data: await bookmarks.bookmarkIds(req.auth!.profile._id) });
  },

  async list(req: Request, res: Response) {
    const q = parse(listQuery, req.query);
    const { items, total } = await bookmarks.listBookmarks(req.auth!.profile._id, q.locale, q.page, q.limit);
    res.json({ data: items, meta: pageMeta(q.page, q.limit, total) });
  },

  async add(req: Request, res: Response) {
    const { group } = parse(groupParams, req.params);
    await bookmarks.addBookmark(req.auth!.profile._id, group);
    res.status(204).end();
  },

  async remove(req: Request, res: Response) {
    const { group } = parse(groupParams, req.params);
    await bookmarks.removeBookmark(req.auth!.profile._id, group);
    res.status(204).end();
  },
};
