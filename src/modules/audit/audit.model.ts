import { Schema, model, type Types } from "mongoose";

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actor?: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "UserProfile", default: null },
    action: { type: String, required: true, maxlength: 80 },
    entityType: { type: String, required: true, maxlength: 40 },
    entityId: { type: String, maxlength: 64 },
    summary: { type: String, maxlength: 300 },
    metadata: { type: Schema.Types.Mixed },
    requestId: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
