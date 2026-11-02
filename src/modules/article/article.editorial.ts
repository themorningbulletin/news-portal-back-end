import type { HydratedDocument, Types } from "mongoose";
import { env } from "../../config/env.js";
import { AppError, forbidden } from "../../lib/errors.js";
import { hasPermission } from "../../lib/permissions.js";
import { allowedImageHosts } from "../media/media.service.js";
import { sanitizeArticleHtml, sanitizePlain } from "../../lib/sanitize.js";
import { htmlToText, readingMinutes, slugify, SLUG_PATTERN } from "../../lib/text.js";
import { Article, ArticleRevision, type ArticleDoc } from "./article.model.js";
import { Media } from "../media/media.model.js";
import { type UserProfileDoc } from "../user/user.model.js";
import { type ArticleStatus, type Locale } from "../../shared/constants.js";

type Profile = HydratedDocument<UserProfileDoc>;
type ArticleLike = Pick<ArticleDoc, "createdBy" | "authors" | "status">;

/** Fields copied into revision snapshots and restorable from them. */
export const EDITABLE_FIELDS = [
  "title",
  "slug",
  "summary",
  "body",
  "format",
  "category",
  "tags",
  "authors",
  "featuredImage",
  "imageAlt",
  "imageCaption",
  "imageCredit",
  "videoUrl",
  "seo",
  "isFeatured",
  "isEditorsPick",
  "pinnedUntil",
  "breakingUntil",
] as const;

export function isOwner(user: Profile, article: ArticleLike): boolean {
  return (
    String(article.createdBy) === String(user._id) || article.authors.some((a) => String(a) === String(user._id))
  );
}

/** Editors edit anything; authors edit only their own drafts. */
export function canEdit(user: Profile, article: ArticleLike): boolean {
  if (hasPermission(user.role, "article:edit_any")) return true;
  return hasPermission(user.role, "article:create") && isOwner(user, article) && article.status === "draft";
}

export function canPublish(user: Profile, article: ArticleLike): boolean {
  if (hasPermission(user.role, "article:publish")) return true;
  return hasPermission(user.role, "article:create") && user.canPublish && isOwner(user, article);
}

/** Featured flags, pinning and breaking banners are homepage decisions reserved for editors. */
export function canCurate(user: Profile): boolean {
  return hasPermission(user.role, "homepage:manage");
}

export function prepareContent<T extends { body?: string; title?: string; summary?: string }>(input: T, locale: Locale) {
  const out: Record<string, unknown> = { ...input };
  if (input.title !== undefined) out.title = sanitizePlain(input.title);
  if (input.summary !== undefined) out.summary = sanitizePlain(input.summary);
  if (input.body !== undefined) {
    const body = sanitizeArticleHtml(input.body, allowedImageHosts());
    const text = htmlToText(body);
    out.body = body;
    out.bodyText = text;
    out.readingMinutes = readingMinutes(text, locale);
  }
  return out;
}

/** Returns a slug unique within the locale, appending -2, -3, ... when needed. */
export async function uniqueSlug(locale: Locale, desired: string, excludeId?: Types.ObjectId): Promise<string> {
  const base = slugify(desired) || "story";
  if (!SLUG_PATTERN.test(base)) throw new AppError("validation_failed", "Slug contains unsupported characters");
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await Article.exists({
      locale,
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return candidate;
  }
  throw new AppError("conflict", "Could not find a free slug");
}

export async function snapshot(
  article: HydratedDocument<ArticleDoc>,
  reason: "manual" | "autosave" | "transition" | "restore",
  user: Profile,
): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) data[f] = article.get(f);
  await ArticleRevision.create({
    article: article._id,
    version: article.version,
    reason,
    status: article.status,
    snapshot: JSON.parse(JSON.stringify(data)),
    createdBy: user._id,
  });
}

/** Autosaves create a revision at most every 10 minutes so history stays readable. */
export async function shouldSnapshotAutosave(articleId: Types.ObjectId): Promise<boolean> {
  const last = await ArticleRevision.findOne({ article: articleId }).sort({ createdAt: -1 }).select("createdAt").lean();
  return !last || Date.now() - last.createdAt.getTime() > 10 * 60_000;
}

export interface ChecklistItem {
  id: string;
  ok: boolean;
  blocking: boolean;
}

const INTERNAL_LINK = /href="([^"]+)"/g;

/**
 * Pre-publication checks. Blocking items stop publishing on the server;
 * the rest are editorial SEO/content-health warnings shown in the CMS.
 */
export async function checklist(article: HydratedDocument<ArticleDoc> | ArticleDoc): Promise<ChecklistItem[]> {
  const body = article.body ?? "";
  const text = htmlToText(body);
  const media = article.featuredImage ? await Media.findById(article.featuredImage).lean() : null;
  const alt = article.imageAlt || media?.alt?.[article.locale];
  const credit = article.imageCredit || media?.credit;

  const siteHost = new URL(env().WEB_BASE_URL).host;
  const brokenLinks: string[] = [];
  for (const match of body.matchAll(INTERNAL_LINK)) {
    const href = match[1] ?? "";
    let path = href;
    if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (u.host !== siteHost) continue;
        path = u.pathname;
      } catch {
        continue;
      }
    }
    const m = /^\/(bn|en)\/news\/([^/?#]+)/.exec(path);
    if (!m) continue;
    let slug = m[2]!;
    try {
      slug = decodeURIComponent(slug);
    } catch {
      brokenLinks.push(href);
      continue;
    }
    const exists = await Article.exists({ locale: m[1] as Locale, slug, status: "published" });
    if (!exists) brokenLinks.push(href);
  }

  const ownUrl = `${env().WEB_BASE_URL}/${article.locale}/news/${encodeURIComponent(article.slug)}`;
  const canonical = article.seo?.canonicalUrl;
  const hasTranslation = await Article.exists({ translationGroup: article.translationGroup, _id: { $ne: article._id } });

  return [
    { id: "headline", ok: article.title.trim().length >= 5, blocking: true },
    { id: "summary", ok: (article.summary ?? "").trim().length >= 20, blocking: true },
    { id: "body", ok: text.length >= 50, blocking: true },
    { id: "category", ok: Boolean(article.category), blocking: true },
    { id: "attribution", ok: article.authors.length > 0, blocking: true },
    { id: "slug", ok: SLUG_PATTERN.test(article.slug), blocking: true },
    { id: "image_alt", ok: !article.featuredImage || Boolean(alt), blocking: true },
    { id: "image_credit", ok: !article.featuredImage || Boolean(credit), blocking: true },
    { id: "featured_image", ok: Boolean(article.featuredImage), blocking: false },
    { id: "seo_description", ok: Boolean(article.seo?.description), blocking: false },
    { id: "title_length", ok: article.title.length <= 110, blocking: false },
    { id: "tags", ok: article.tags.length > 0, blocking: false },
    { id: "internal_links", ok: brokenLinks.length === 0, blocking: false },
    { id: "canonical", ok: !canonical || canonical === ownUrl, blocking: false },
    { id: "translation", ok: Boolean(hasTranslation), blocking: false },
  ];
}

export async function assertPublishable(article: HydratedDocument<ArticleDoc>): Promise<void> {
  const failed = (await checklist(article)).filter((c) => c.blocking && !c.ok).map((c) => c.id);
  if (failed.length) {
    throw new AppError("validation_failed", "The story is missing required information", { checklist: failed });
  }
}

export type TransitionAction = "submit" | "withdraw" | "publish" | "schedule" | "unschedule" | "unpublish" | "archive" | "restore";

const ALLOWED_FROM: Record<TransitionAction, ArticleStatus[]> = {
  submit: ["draft"],
  withdraw: ["in_review"],
  publish: ["draft", "in_review", "scheduled"],
  schedule: ["draft", "in_review"],
  unschedule: ["scheduled"],
  unpublish: ["published"],
  archive: ["draft", "in_review", "scheduled", "published"],
  restore: ["archived"],
};

export function assertTransitionAllowed(user: Profile, article: HydratedDocument<ArticleDoc>, action: TransitionAction) {
  if (!ALLOWED_FROM[action].includes(article.status)) {
    throw new AppError("conflict", `Cannot ${action} a story that is ${article.status}`);
  }
  const owner = isOwner(user, article);
  const editor = hasPermission(user.role, "article:edit_any");
  switch (action) {
    case "submit":
    case "withdraw":
      if (!editor && !(owner && hasPermission(user.role, "article:create"))) throw forbidden();
      return;
    case "publish":
    case "schedule":
    case "unschedule":
      if (!canPublish(user, article)) throw forbidden("Publishing requires editor permission");
      return;
    case "unpublish":
    case "archive":
    case "restore":
      if (!editor) throw forbidden("Only editors can do this");
      return;
  }
}

export function revalidationTags(article: Pick<ArticleDoc, "locale" | "slug" | "previousSlugs" | "translationGroup">, extraSlugs: string[] = []) {
  const slugs = new Set([article.slug, ...article.previousSlugs, ...extraSlugs]);
  return [
    "articles",
    `article-group:${String(article.translationGroup)}`,
    ...[...slugs].map((s) => `article:${article.locale}:${s}`),
  ];
}
