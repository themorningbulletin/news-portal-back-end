import { Schema, model, type Types } from "mongoose";

export interface RoleDoc {
  _id: Types.ObjectId;
  key: string;
  /** Display name of a custom role; built-in roles are named by the site's translations. */
  name: { bn?: string; en?: string };
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Custom roles, plus a row for each built-in role an admin has changed. */
const roleSchema = new Schema<RoleDoc>(
  {
    key: { type: String, required: true, maxlength: 40, match: /^[a-z][a-z0-9_-]*$/ },
    name: { bn: { type: String, trim: true, maxlength: 60 }, en: { type: String, trim: true, maxlength: 60 } },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
);
roleSchema.index({ key: 1 }, { unique: true });

export const RoleModel = model<RoleDoc>("Role", roleSchema);
