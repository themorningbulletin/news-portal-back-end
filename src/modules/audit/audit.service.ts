import type { Request } from "express";
import type { Types } from "mongoose";
import { notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { AuditLog } from "./audit.model.js";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/** Records who changed what. Audit failures are logged but never block the editorial action. */
export async function audit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      ...entry,
      actor: req.auth?.profile._id ?? null,
      requestId: String(req.id),
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "failed to write audit log");
  }
}

export async function listAudit(q: { page: number; limit: number; entityType?: string; entityId?: string }) {
  const filter: Record<string, unknown> = {};
  if (q.entityType) filter.entityType = q.entityType;
  if (q.entityId) filter.entityId = q.entityId;
  const [docs, total] = await Promise.all([
    AuditLog.find(filter).populate("actor", "displayName email").sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items: docs.map((d) => ({ ...d, id: String(d._id) })), total };
}

export async function getAuditEntry(id: Types.ObjectId) {
  const doc = await AuditLog.findById(id).lean();
  if (!doc) throw notFound("Audit entry");
  return doc;
}
