import { Schema, model, type Types } from "mongoose";
import {
  AD_PLACEMENT_KEYS,
  type AdPlacementKey,
} from "../../shared/constants.js";

export interface AdPlacementDoc {
  _id: Types.ObjectId;
  key: AdPlacementKey;
  enabled: boolean;
  slotId?: string;
  format: "auto" | "rectangle" | "horizontal" | "fluid";
  minHeight: number;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adPlacementSchema = new Schema<AdPlacementDoc>(
  {
    key: { type: String, enum: AD_PLACEMENT_KEYS, required: true },
    enabled: { type: Boolean, default: false },
    slotId: { type: String, trim: true, match: /^\d{6,20}$/ },
    format: { type: String, enum: ["auto", "rectangle", "horizontal", "fluid"], default: "auto" },
    minHeight: { type: Number, min: 50, max: 600, default: 250 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true },
);
adPlacementSchema.index({ key: 1 }, { unique: true });

export const AdPlacement = model<AdPlacementDoc>("AdPlacement", adPlacementSchema);
