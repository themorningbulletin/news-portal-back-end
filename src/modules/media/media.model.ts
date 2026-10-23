import { Schema, model, type Types } from "mongoose";
import {
  localizedString,
  type Localized,
} from "../../shared/constants.js";

export interface MediaDoc {
  _id: Types.ObjectId;
  provider: "cloudinary" | "static";
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  alt: Localized;
  caption: Localized;
  credit?: string;
  focalX: number;
  focalY: number;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<MediaDoc>(
  {
    provider: { type: String, enum: ["cloudinary", "static"], required: true },
    publicId: { type: String, required: true, maxlength: 300 },
    url: { type: String, required: true, maxlength: 1000 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, maxlength: 10 },
    bytes: { type: Number, default: 0 },
    alt: { type: localizedString({ maxlength: 300 }), default: () => ({}) },
    caption: { type: localizedString({ maxlength: 500 }), default: () => ({}) },
    credit: { type: String, trim: true, maxlength: 200 },
    focalX: { type: Number, min: 0, max: 100, default: 50 },
    focalY: { type: Number, min: 0, max: 100, default: 50 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true },
);
mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ provider: 1, publicId: 1 }, { unique: true });

export const Media = model<MediaDoc>("Media", mediaSchema);
