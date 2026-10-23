import { Schema, model, type Types } from "mongoose";
import {
  localizedString,
  type Localized,
} from "../../shared/constants.js";

export interface TagDoc {
  _id: Types.ObjectId;
  name: Localized;
  slug: Localized;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<TagDoc>(
  {
    name: { type: localizedString({ maxlength: 60 }), required: true },
    slug: { type: localizedString({ maxlength: 80 }), required: true },
  },
  { timestamps: true },
);
// A tag may exist in only one language, so uniqueness only applies where the slug exists.
tagSchema.index({ "slug.bn": 1 }, { unique: true, partialFilterExpression: { "slug.bn": { $type: "string" } } });
tagSchema.index({ "slug.en": 1 }, { unique: true, partialFilterExpression: { "slug.en": { $type: "string" } } });

export const Tag = model<TagDoc>("Tag", tagSchema);
