import type { Request, Response } from "express";
import { z } from "zod";
import { idParams, pageMeta, paginationSchema, parse } from "../../lib/http.js";
import { getAuditEntry, listAudit } from "./audit.service.js";

const listQuery = paginationSchema.extend({ entityType: z.string().max(40).optional(), entityId: z.string().max(64).optional() });

export const auditController = {
  async list(req: Request, res: Response) {
    const q = parse(listQuery, req.query);
    const { items, total } = await listAudit(q);
    res.json({ data: items, meta: pageMeta(q.page, q.limit, total) });
  },

  async get(req: Request, res: Response) {
    const { id } = parse(idParams, req.params);
    res.json({ data: await getAuditEntry(id) });
  },
};
