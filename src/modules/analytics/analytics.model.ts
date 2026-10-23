import { Schema, model, type Types } from "mongoose";
import {
  LOCALES,
  type Locale,
} from "../../shared/constants.js";

export interface ArticleDailyStatDoc {
  _id: Types.ObjectId;
  article: Types.ObjectId;
  locale: Locale;
  day: string; // YYYY-MM-DD (UTC)
  views: number;
  expiresAt: Date;
}

const articleDailyStatSchema = new Schema<ArticleDailyStatDoc>({
  article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
  locale: { type: String, enum: LOCALES, required: true },
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  views: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
articleDailyStatSchema.index({ article: 1, day: 1 }, { unique: true });
articleDailyStatSchema.index({ locale: 1, day: 1, views: -1 });
articleDailyStatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ArticleDailyStat = model<ArticleDailyStatDoc>("ArticleDailyStat", articleDailyStatSchema);

export interface ReferrerDailyStatDoc {
  _id: Types.ObjectId;
  day: string;
  host: string;
  views: number;
  expiresAt: Date;
}

const referrerDailyStatSchema = new Schema<ReferrerDailyStatDoc>({
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  host: { type: String, required: true, maxlength: 253 },
  views: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
referrerDailyStatSchema.index({ day: 1, host: 1 }, { unique: true });
referrerDailyStatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ReferrerDailyStat = model<ReferrerDailyStatDoc>("ReferrerDailyStat", referrerDailyStatSchema);
