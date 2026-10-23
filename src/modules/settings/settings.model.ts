import { Schema, model, type Types } from "mongoose";

export const HOMEPAGE_VARIANTS = ["grid", "list", "feature"] as const;

export interface SiteSettingsDoc {
  _id: Types.ObjectId;
  key: "site";
  homepageSections: { category: Types.ObjectId; variant: (typeof HOMEPAGE_VARIANTS)[number] }[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<SiteSettingsDoc>(
  {
    key: { type: String, enum: ["site"], default: "site" },
    homepageSections: {
      type: [
        new Schema(
          {
            category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
            variant: { type: String, enum: HOMEPAGE_VARIANTS, default: "grid" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true },
);
siteSettingsSchema.index({ key: 1 }, { unique: true });

export const SiteSettings = model<SiteSettingsDoc>("SiteSettings", siteSettingsSchema);
