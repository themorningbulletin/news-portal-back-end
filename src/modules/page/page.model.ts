import { Schema, model, type Types } from "mongoose";
import {
  LOCALES,
  PAGE_KEYS,
  type Locale,
  type PageKey,
} from "../../shared/constants.js";

export interface PageDoc {
  _id: Types.ObjectId;
  key: PageKey;
  locale: Locale;
  title: string;
  body: string;
  status: "draft" | "published";
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<PageDoc>(
  {
    key: { type: String, enum: PAGE_KEYS, required: true },
    locale: { type: String, enum: LOCALES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, default: "", maxlength: 200_000 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true },
);
pageSchema.index({ key: 1, locale: 1 }, { unique: true });

export const Page = model<PageDoc>("Page", pageSchema);
