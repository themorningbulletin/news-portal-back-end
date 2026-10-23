import { Schema, model, type Types } from "mongoose";
import {
  localizedString,
  type Localized,
} from "../../shared/constants.js";

export interface CategoryDoc {
  _id: Types.ObjectId;
  name: Required<Localized>;
  slug: Required<Localized>;
  description: Localized;
  parent?: Types.ObjectId | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: {
      bn: { type: String, required: true, trim: true, maxlength: 80 },
      en: { type: String, required: true, trim: true, maxlength: 80 },
    },
    slug: {
      bn: { type: String, required: true, trim: true, maxlength: 120 },
      en: { type: String, required: true, trim: true, maxlength: 120 },
    },
    description: { type: localizedString({ maxlength: 400 }), default: () => ({}) },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
categorySchema.index({ "slug.bn": 1 }, { unique: true });
categorySchema.index({ "slug.en": 1 }, { unique: true });
categorySchema.index({ parent: 1, order: 1 });

export const Category = model<CategoryDoc>("Category", categorySchema);
