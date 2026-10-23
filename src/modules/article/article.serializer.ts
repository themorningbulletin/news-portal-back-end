import type { Types } from "mongoose";
import type { Locale } from "../../shared/constants.js";
import { serializeCategory, type LeanCategory } from "../category/category.serializer.js";
import { serializeImage, type LeanMedia } from "../media/media.serializer.js";
import { serializeTag, type LeanTag } from "../tag/tag.serializer.js";
import { serializeAuthor, type LeanAuthor } from "../user/user.serializer.js";

/* Shape of a populated, lean article document. */
export interface LeanArticle {
  _id: Types.ObjectId;
  locale: Locale;
  translationGroup: Types.ObjectId;
  status: string;
  format: string;
  title: string;
  slug: string;
  summary: string;
  body?: string;
  readingMinutes: number;
  category?: LeanCategory | null;
  tags?: LeanTag[];
  authors?: LeanAuthor[];
  featuredImage?: LeanMedia | null;
  imageAlt?: string;
  imageCaption?: string;
  imageCredit?: string;
  videoUrl?: string;
  seo?: { title?: string; description?: string; canonicalUrl?: string; socialImage?: LeanMedia | null };
  isFeatured?: boolean;
  isEditorsPick?: boolean;
  breakingUntil?: Date | null;
  publishedAt?: Date | null;
  contentUpdatedAt?: Date | null;
  updatedAt?: Date;
}

export function serializeArticleCard(a: LeanArticle, now = new Date()) {
  return {
    id: String(a._id),
    translationGroup: String(a.translationGroup),
    locale: a.locale,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    format: a.format,
    category: a.category ? serializeCategory(a.category, a.locale) : null,
    image: serializeImage(a.featuredImage, a.locale, {
      alt: a.imageAlt,
      caption: a.imageCaption,
      credit: a.imageCredit,
    }),
    authors: (a.authors ?? []).map((au) => serializeAuthor(au, a.locale)),
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    updatedAt: a.contentUpdatedAt?.toISOString() ?? null,
    isBreaking: Boolean(a.breakingUntil && a.breakingUntil > now),
  };
}

export function serializeArticleDetail(
  a: LeanArticle,
  translations: { locale: Locale; slug: string }[],
  now = new Date(),
) {
  return {
    ...serializeArticleCard(a, now),
    body: a.body ?? "",
    tags: (a.tags ?? []).map((t) => serializeTag(t, a.locale)).filter((t) => t.slug),
    videoUrl: a.videoUrl ?? null,
    seo: {
      title: a.seo?.title ?? "",
      description: a.seo?.description ?? "",
      canonicalUrl: a.seo?.canonicalUrl ?? "",
      socialImage: serializeImage(a.seo?.socialImage, a.locale),
    },
    translations,
  };
}

export type ArticleCard = ReturnType<typeof serializeArticleCard>;
