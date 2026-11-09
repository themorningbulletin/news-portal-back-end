import { Schema, model, type Types } from "mongoose";

/**
 * Homepage blocks. feature: big story left, list right · side: stories stacked on the
 * left, big story right · center: big story in the middle, lists either side ·
 * trio: big story, two stacked, one more (three columns) · grid: cards side by side ·
 * list: thumbnail rows · mosaic: big story on top, the rest below.
 */
export const HOMEPAGE_VARIANTS = ["feature", "side", "center", "trio", "grid", "list", "mosaic"] as const;
/** Width on a 12-column row: full, 3/4, 2/3, half, 1/3, 1/4, 1/6. */
export const HOMEPAGE_WIDTHS = [12, 9, 8, 6, 4, 3, 2] as const;
export const HOMEPAGE_KINDS = ["section", "ad"] as const;

export interface HomepageBlockDoc {
  kind: (typeof HOMEPAGE_KINDS)[number];
  category?: Types.ObjectId | null;
  variant: (typeof HOMEPAGE_VARIANTS)[number];
  width: (typeof HOMEPAGE_WIDTHS)[number];
  count?: number | null;
}

export interface SocialLinks {
  facebook?: string;
  x?: string;
  youtube?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
  telegram?: string;
}
export const SOCIAL_KEYS = ["facebook", "x", "youtube", "instagram", "linkedin", "tiktok", "whatsapp", "telegram"] as const;

export interface SiteSettingsDoc {
  _id: Types.ObjectId;
  key: "site";
  homepageSections: HomepageBlockDoc[];
  social: SocialLinks;
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
            kind: { type: String, enum: HOMEPAGE_KINDS, default: "section" },
            category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
            variant: { type: String, enum: HOMEPAGE_VARIANTS, default: "grid" },
            width: { type: Number, enum: HOMEPAGE_WIDTHS, default: 12 },
            count: { type: Number, min: 1, max: 12, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    social: {
      type: new Schema(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, { type: String, trim: true, maxlength: 300 }])), { _id: false }),
      default: () => ({}),
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true },
);
siteSettingsSchema.index({ key: 1 }, { unique: true });

export const SiteSettings = model<SiteSettingsDoc>("SiteSettings", siteSettingsSchema);
