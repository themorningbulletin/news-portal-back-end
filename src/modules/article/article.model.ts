import { Schema, model, type Types } from "mongoose";
import {
  ARTICLE_FORMATS,
  ARTICLE_STATUSES,
  LOCALES,
  type ArticleFormat,
  type ArticleStatus,
  type Locale,
} from "../../shared/constants.js";

export interface EditorialNote {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface ArticleDoc {
  _id: Types.ObjectId;
  locale: Locale;
  translationGroup: Types.ObjectId;
  status: ArticleStatus;
  format: ArticleFormat;
  title: string;
  slug: string;
  previousSlugs: string[];
  summary: string;
  body: string;
  bodyText: string;
  readingMinutes: number;
  category?: Types.ObjectId | null;
  tags: Types.ObjectId[];
  authors: Types.ObjectId[];
  createdBy: Types.ObjectId;
  featuredImage?: Types.ObjectId | null;
  imageCaption?: string;
  imageCredit?: string;
  imageAlt?: string;
  videoUrl?: string;
  seo: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    socialImage?: Types.ObjectId | null;
    focusKeyword?: string;
  };
  isFeatured: boolean;
  isEditorsPick: boolean;
  pinnedUntil?: Date | null;
  breakingUntil?: Date | null;
  scheduledFor?: Date | null;
  publishedAt?: Date | null;
  firstPublishedAt?: Date | null;
  /** Set only when an editor marks a substantive update; drives the visible "Updated" time. */
  contentUpdatedAt?: Date | null;
  editorialNotes: EditorialNote[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<ArticleDoc>(
  {
    locale: { type: String, enum: LOCALES, required: true },
    translationGroup: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ARTICLE_STATUSES, default: "draft" },
    format: { type: String, enum: ARTICLE_FORMATS, default: "standard" },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, trim: true, maxlength: 120 },
    previousSlugs: { type: [String], default: [] },
    summary: { type: String, trim: true, maxlength: 400, default: "" },
    body: { type: String, default: "", maxlength: 300_000 },
    bodyText: { type: String, default: "", select: false },
    readingMinutes: { type: Number, default: 1 },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    tags: { type: [{ type: Schema.Types.ObjectId, ref: "Tag" }], default: [] },
    authors: { type: [{ type: Schema.Types.ObjectId, ref: "UserProfile" }], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true },
    featuredImage: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    imageCaption: { type: String, trim: true, maxlength: 500 },
    imageCredit: { type: String, trim: true, maxlength: 200 },
    imageAlt: { type: String, trim: true, maxlength: 300 },
    videoUrl: { type: String, trim: true, maxlength: 500 },
    seo: {
      title: { type: String, trim: true, maxlength: 120 },
      description: { type: String, trim: true, maxlength: 320 },
      canonicalUrl: { type: String, trim: true, maxlength: 500 },
      socialImage: { type: Schema.Types.ObjectId, ref: "Media", default: null },
      focusKeyword: { type: String, trim: true, maxlength: 80 },
    },
    isFeatured: { type: Boolean, default: false },
    isEditorsPick: { type: Boolean, default: false },
    pinnedUntil: { type: Date, default: null },
    breakingUntil: { type: Date, default: null },
    scheduledFor: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    firstPublishedAt: { type: Date, default: null },
    contentUpdatedAt: { type: Date, default: null },
    editorialNotes: {
      type: [
        new Schema<EditorialNote>(
          {
            author: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true },
            text: { type: String, required: true, trim: true, maxlength: 2000 },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);
articleSchema.index({ locale: 1, slug: 1 }, { unique: true });
articleSchema.index({ locale: 1, previousSlugs: 1 });
articleSchema.index({ translationGroup: 1, locale: 1 }, { unique: true });
articleSchema.index({ locale: 1, status: 1, publishedAt: -1 });
articleSchema.index({ locale: 1, category: 1, status: 1, publishedAt: -1 });
articleSchema.index({ locale: 1, tags: 1, status: 1, publishedAt: -1 });
articleSchema.index({ locale: 1, authors: 1, status: 1, publishedAt: -1 });
articleSchema.index({ status: 1, scheduledFor: 1 });
articleSchema.index({ status: 1, breakingUntil: 1 });
articleSchema.index({ status: 1, updatedAt: -1 });
articleSchema.index({ createdBy: 1, updatedAt: -1 });
// default_language "none" disables stemming, which MongoDB does not support for Bangla.
articleSchema.index(
  { title: "text", summary: "text", bodyText: "text" },
  { weights: { title: 10, summary: 5, bodyText: 1 }, default_language: "none", name: "article_text" },
);

export const Article = model<ArticleDoc>("Article", articleSchema);



export interface ArticleRevisionDoc {
  _id: Types.ObjectId;
  article: Types.ObjectId;
  version: number;
  reason: "manual" | "autosave" | "transition" | "restore";
  status: ArticleStatus;
  snapshot: Record<string, unknown>;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const articleRevisionSchema = new Schema<ArticleRevisionDoc>(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    version: { type: Number, required: true },
    reason: { type: String, enum: ["manual", "autosave", "transition", "restore"], required: true },
    status: { type: String, enum: ARTICLE_STATUSES, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "UserProfile", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
articleRevisionSchema.index({ article: 1, createdAt: -1 });

export const ArticleRevision = model<ArticleRevisionDoc>("ArticleRevision", articleRevisionSchema);
