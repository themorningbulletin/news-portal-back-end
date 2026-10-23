import { Schema } from "mongoose";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const ROLES = ["reader", "author", "editor", "admin", "ad_manager", "moderator"] as const;
export type Role = (typeof ROLES)[number];

export const ARTICLE_STATUSES = ["draft", "in_review", "scheduled", "published", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_FORMATS = ["standard", "explainer", "opinion", "photo", "video"] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export const AD_PLACEMENT_KEYS = [
  "header",
  "home_feed",
  "category_feed",
  "article_inline",
  "sidebar",
  "footer",
] as const;
export type AdPlacementKey = (typeof AD_PLACEMENT_KEYS)[number];

export const PAGE_KEYS = ["about", "contact", "editorial-policy", "corrections", "privacy", "terms"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export interface Localized {
  bn?: string;
  en?: string;
}

/** A pair of optional strings, one per locale. */
export const localizedString = (opts: { maxlength: number }) =>
  new Schema<Localized>(
    {
      bn: { type: String, trim: true, maxlength: opts.maxlength },
      en: { type: String, trim: true, maxlength: opts.maxlength },
    },
    { _id: false },
  );
