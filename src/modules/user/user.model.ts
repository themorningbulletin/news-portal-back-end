import { Schema, model, type Types } from "mongoose";
import {
  LOCALES,
  localizedString,
  type Locale,
  type Localized,
} from "../../shared/constants.js";

export interface UserProfileDoc {
  _id: Types.ObjectId;
  firebaseUid: string;
  email?: string;
  displayName?: string;
  /** A built-in role (see shared/constants.ts) or a custom role key. */
  role: string;
  /** Explicit permission for an author to publish their own stories. */
  canPublish: boolean;
  disabled: boolean;
  author: {
    isPublic: boolean;
    slug?: string;
    name: Localized;
    bio: Localized;
    avatarUrl?: string;
  };
  preferences: {
    theme: "system" | "light" | "dark";
    textSize: "sm" | "md" | "lg" | "xl";
    locale?: Locale;
  };
  followedCategories: Types.ObjectId[];
  followedTags: Types.ObjectId[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<UserProfileDoc>(
  {
    firebaseUid: { type: String, required: true, maxlength: 128 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    displayName: { type: String, trim: true, maxlength: 120 },
    role: { type: String, default: "reader", maxlength: 40 },
    canPublish: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    author: {
      isPublic: { type: Boolean, default: false },
      slug: { type: String, trim: true, maxlength: 80 },
      name: { type: localizedString({ maxlength: 120 }), default: () => ({}) },
      bio: { type: localizedString({ maxlength: 600 }), default: () => ({}) },
      avatarUrl: { type: String, maxlength: 500 },
    },
    preferences: {
      theme: { type: String, enum: ["system", "light", "dark"], default: "system" },
      textSize: { type: String, enum: ["sm", "md", "lg", "xl"], default: "md" },
      locale: { type: String, enum: LOCALES },
    },
    followedCategories: { type: [{ type: Schema.Types.ObjectId, ref: "Category" }], default: [] },
    followedTags: { type: [{ type: Schema.Types.ObjectId, ref: "Tag" }], default: [] },
    lastLoginAt: Date,
  },
  { timestamps: true },
);
userProfileSchema.index({ firebaseUid: 1 }, { unique: true });
userProfileSchema.index({ email: 1 });
userProfileSchema.index({ role: 1 });
userProfileSchema.index(
  { "author.slug": 1 },
  { unique: true, partialFilterExpression: { "author.slug": { $type: "string" } } },
);

export const UserProfile = model<UserProfileDoc>("UserProfile", userProfileSchema);
