import { Types, type HydratedDocument } from "mongoose";
import { AppError, conflict, forbidden, notFound } from "../../lib/errors.js";
import { hasPermission } from "../../lib/permissions.js";
import { escapeRegex, slugify, SLUG_PATTERN } from "../../lib/text.js";
import { viewsByArticle } from "../analytics/analytics.service.js";
import { Category } from "../category/category.model.js";
import { Media } from "../media/media.model.js";
import { Tag } from "../tag/tag.model.js";
import { UserProfile } from "../user/user.model.js";
import type { Profile } from "../user/user.service.js";
import {
  assertPublishable,
  assertTransitionAllowed,
  canCurate,
  canEdit,
  canPublish,
  checklist,
  EDITABLE_FIELDS,
  isOwner,
  prepareContent,
  shouldSnapshotAutosave,
  snapshot,
  uniqueSlug,
  type TransitionAction,
} from "./article.editorial.js";
import { Article, ArticleRevision, type ArticleDoc } from "./article.model.js";
import type { ArticleFieldsInput, CreateArticleInput, UpdateArticleInput } from "./article.validation.js";

type ArticleDocument = HydratedDocument<ArticleDoc>;

const CURATION_KEYS = ["isFeatured", "isEditorsPick", "pinnedUntil", "breakingUntil"] as const;

/** Every referenced section, tag, image and byline must exist (and bylines must be active staff). */
async function assertRefs(input: ArticleFieldsInput) {
  if (input.category && !(await Category.exists({ _id: input.category }))) throw new AppError("validation_failed", "Unknown category");
  if (input.tags?.length && (await Tag.countDocuments({ _id: { $in: input.tags } })) !== new Set(input.tags.map(String)).size) {
    throw new AppError("validation_failed", "Unknown tag");
  }
  for (const m of [input.featuredImage, input.seo?.socialImage]) {
    if (m && !(await Media.exists({ _id: m }))) throw new AppError("validation_failed", "Unknown media item");
  }
  if (input.authors?.length) {
    const staff = await UserProfile.countDocuments({ _id: { $in: input.authors }, role: { $in: ["author", "editor", "admin"] }, disabled: false });
    if (staff !== new Set(input.authors.map(String)).size) throw new AppError("validation_failed", "Authors must be active newsroom staff");
  }
}

/** Converts API input into Mongo paths: ISO strings to dates, "" to null, nested SEO fields to dotted keys. */
function toDbFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if ((k === "pinnedUntil" || k === "breakingUntil") && typeof v === "string") out[k] = new Date(v);
    else if (k === "videoUrl" && v === "") out[k] = null;
    else if (k === "seo" && v && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) if (sv !== undefined) out[`seo.${sk}`] = sv === "" ? null : sv;
    } else out[k] = v;
  }
  return out;
}

/** The CMS view of a story: full document, checklist, translations and the actions this user may take. */
export async function adminView(article: ArticleDocument, user: Profile) {
  const translations = await Article.find({ translationGroup: article.translationGroup, _id: { $ne: article._id } })
    .select("locale slug title status")
    .lean();
  const items = await checklist(article);
  const json = article.toObject({ versionKey: false });
  const publishable = canPublish(user, article);
  const editor = hasPermission(user.role, "article:edit_any");
  const owner = isOwner(user, article);
  const actions: TransitionAction[] = [];
  const s = article.status;
  if (s === "draft" && (editor || owner)) actions.push("submit");
  if (s === "in_review" && (editor || owner)) actions.push("withdraw");
  if (["draft", "in_review", "scheduled"].includes(s) && publishable) actions.push("publish");
  if (["draft", "in_review"].includes(s) && publishable) actions.push("schedule");
  if (s === "scheduled" && publishable) actions.push("unschedule");
  if (s === "published" && editor) actions.push("unpublish");
  if (s !== "archived" && editor) actions.push("archive");
  if (s === "archived" && editor) actions.push("restore");
  const [views7, views30] = await Promise.all([viewsByArticle([article._id], 7), viewsByArticle([article._id], 30)]);
  return {
    ...json,
    id: String(article._id),
    stats: { views7: views7.get(String(article._id)) ?? 0, views30: views30.get(String(article._id)) ?? 0 },
    translations: translations.map((t) => ({ id: String(t._id), locale: t.locale, slug: t.slug, title: t.title, status: t.status })),
    checklist: items,
    permissions: { canEdit: canEdit(user, article), canPublish: publishable, canCurate: canCurate(user), actions },
  };
}

/** Authors may only open their own stories; anything else looks like it does not exist. */
export async function loadForUser(user: Profile, id: Types.ObjectId) {
  const article = await Article.findById(id).select("+bodyText");
  if (!article) throw notFound("Article");
  if (!hasPermission(user.role, "article:edit_any") && !isOwner(user, article)) throw notFound("Article");
  return article;
}

export async function listForNewsroom(
  user: Profile,
  q: { page: number; limit: number; status?: string; locale?: string; category?: Types.ObjectId; q?: string; mine?: string; sort: string },
) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.locale) filter.locale = q.locale;
  if (q.category) filter.category = q.category;
  if (q.q) filter.title = new RegExp(escapeRegex(q.q.normalize("NFC")), "i");
  // Authors only see their own work; editors see the whole newsroom.
  if (q.mine === "true" || !hasPermission(user.role, "article:edit_any")) {
    filter.$or = [{ createdBy: user._id }, { authors: user._id }];
  }
  const sort: Record<string, 1 | -1> = q.sort === "published" ? { publishedAt: -1 } : q.sort === "scheduled" ? { scheduledFor: 1 } : { updatedAt: -1 };
  const [docs, total] = await Promise.all([
    Article.find(filter)
      .select("locale translationGroup status format title slug category authors updatedAt publishedAt scheduledFor isFeatured breakingUntil version")
      .populate("category", "name")
      .populate("authors", "displayName author.name")
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Article.countDocuments(filter),
  ]);
  const views = await viewsByArticle(docs.map((d) => d._id), 7);
  return { docs: docs.map((d) => ({ ...d, id: String(d._id), views7: views.get(String(d._id)) ?? 0 })), total };
}

export async function createArticle(user: Profile, input: CreateArticleInput) {
  if (!canCurate(user) && CURATION_KEYS.some((k) => input[k] !== undefined && input[k] !== null && input[k] !== false)) {
    throw forbidden("Only editors can feature, pin or mark stories as breaking");
  }
  await assertRefs(input);

  let translationGroup = new Types.ObjectId();
  if (input.translationOf) {
    const source = await Article.findById(input.translationOf).select("translationGroup locale");
    if (!source) throw notFound("Source article");
    if (source.locale === input.locale) throw new AppError("validation_failed", "A translation must use the other language");
    if (await Article.exists({ translationGroup: source.translationGroup, locale: input.locale })) {
      throw conflict("This story already has a version in that language");
    }
    translationGroup = source.translationGroup;
  }
  if (input.slug && !SLUG_PATTERN.test(slugify(input.slug))) throw new AppError("validation_failed", "Invalid slug");
  const slug = await uniqueSlug(input.locale, input.slug || input.title);

  const { translationOf: _t, locale, ...fields } = input;
  const article = await Article.create({
    ...toDbFields(prepareContent(fields, locale)),
    locale,
    slug,
    translationGroup,
    status: "draft",
    authors: input.authors?.length ? input.authors : [user._id],
    createdBy: user._id,
  });
  await snapshot(article, "manual", user);
  return article;
}

/**
 * Saves edits with optimistic concurrency: the update only applies to the
 * version the editor loaded, otherwise 409 with the current version.
 */
export async function updateArticle(user: Profile, id: Types.ObjectId, input: UpdateArticleInput) {
  const article = await loadForUser(user, id);
  if (!canEdit(user, article)) throw forbidden("You cannot edit this story in its current state");

  if (!canCurate(user)) {
    for (const k of CURATION_KEYS) {
      if (input[k] === undefined) continue;
      const current: unknown = article.get(k);
      const next: unknown = input[k];
      const asTime = (v: unknown) => (v instanceof Date || typeof v === "string" ? new Date(v).getTime() : null);
      const same = k === "isFeatured" || k === "isEditorsPick" ? Boolean(next) === Boolean(current) : asTime(next) === asTime(current);
      if (!same) throw forbidden("Only editors can feature, pin or mark stories as breaking");
    }
  }
  await assertRefs(input);

  const { version, revision, markUpdated, slug: requestedSlug, ...fields } = input;
  const set: Record<string, unknown> = toDbFields(prepareContent(fields, article.locale));
  const oldSlug = article.slug;

  if (requestedSlug !== undefined && slugify(requestedSlug) !== article.slug) {
    const next = slugify(requestedSlug);
    if (!next || !SLUG_PATTERN.test(next)) throw new AppError("validation_failed", "Invalid slug");
    if (await Article.exists({ locale: article.locale, slug: next, _id: { $ne: article._id } })) {
      throw conflict("Another story already uses this slug");
    }
    set.slug = next;
    // Once a URL has been public, keep it working with a permanent redirect.
    if (article.firstPublishedAt) {
      set.previousSlugs = [...new Set([...article.previousSlugs, oldSlug])].filter((s) => s !== next);
    }
  }
  if (markUpdated && article.status === "published") set.contentUpdatedAt = new Date();

  const updated = await Article.findOneAndUpdate({ _id: article._id, version }, { $set: set, $inc: { version: 1 } }, {
    returnDocument: "after",
    runValidators: true,
  }).select("+bodyText");
  if (!updated) {
    const current = await Article.findById(article._id).select("version updatedAt").lean();
    throw conflict("This story was changed by someone else. Reload to see the latest version.", {
      currentVersion: current?.version,
      updatedAt: current?.updatedAt,
    });
  }
  if (revision === "manual" || (await shouldSnapshotAutosave(updated._id))) await snapshot(updated, revision, user);
  return { updated, oldSlug, slugChanged: Boolean(set.slug), revision };
}

/** Moves a story through the editorial workflow (permission and state are checked server-side). */
export async function transitionArticle(user: Profile, id: Types.ObjectId, input: { action: TransitionAction; version: number; scheduledFor?: string }) {
  const article = await loadForUser(user, id);
  if (article.version !== input.version) throw conflict("This story was changed by someone else. Reload first.");
  assertTransitionAllowed(user, article, input.action);

  const now = new Date();
  const set: Record<string, unknown> = {};
  switch (input.action) {
    case "submit":
      set.status = "in_review";
      break;
    case "withdraw":
    case "unschedule":
    case "unpublish":
    case "restore":
      set.status = "draft";
      set.scheduledFor = null;
      break;
    case "archive":
      set.status = "archived";
      set.scheduledFor = null;
      break;
    case "publish":
      await assertPublishable(article);
      set.status = "published";
      set.scheduledFor = null;
      // Republishing keeps the original publication time: no fake freshness.
      set.publishedAt = article.firstPublishedAt ?? now;
      set.firstPublishedAt = article.firstPublishedAt ?? now;
      break;
    case "schedule": {
      if (!input.scheduledFor) throw new AppError("validation_failed", "scheduledFor is required");
      const when = new Date(input.scheduledFor);
      if (when.getTime() < now.getTime() + 60_000) throw new AppError("validation_failed", "Schedule at least one minute ahead");
      if (when.getTime() > now.getTime() + 366 * 86_400_000) throw new AppError("validation_failed", "Schedule within one year");
      await assertPublishable(article);
      set.status = "scheduled";
      set.scheduledFor = when;
      break;
    }
  }

  const wasPublic = article.status === "published";
  const updated = await Article.findOneAndUpdate(
    { _id: article._id, version: input.version },
    { $set: set, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  ).select("+bodyText");
  if (!updated) throw conflict("This story was changed by someone else. Reload first.");
  await snapshot(updated, "transition", user);
  return { updated, wasPublic };
}

export async function addNote(user: Profile, id: Types.ObjectId, text: string) {
  const article = await loadForUser(user, id);
  article.editorialNotes.push({ _id: new Types.ObjectId(), author: user._id, text, createdAt: new Date() });
  await Article.updateOne({ _id: article._id }, { $set: { editorialNotes: article.editorialNotes } });
  return article;
}

export async function listRevisions(user: Profile, id: Types.ObjectId) {
  await loadForUser(user, id);
  const revs = await ArticleRevision.find({ article: id }).sort({ createdAt: -1 }).limit(100).populate("createdBy", "displayName email").lean();
  return revs.map((rv) => ({ ...rv, id: String(rv._id) }));
}

/** Restores the content of an old revision as the current version (the slug is kept). */
export async function restoreRevision(user: Profile, id: Types.ObjectId, revisionId: Types.ObjectId, version: number) {
  const article = await loadForUser(user, id);
  if (!canEdit(user, article)) throw forbidden("You cannot edit this story in its current state");
  const rev = await ArticleRevision.findOne({ _id: revisionId, article: id }).lean();
  if (!rev) throw notFound("Revision");

  const set: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (f === "slug") continue;
    if (!canCurate(user) && (CURATION_KEYS as readonly string[]).includes(f)) continue;
    if (f in rev.snapshot) set[f] = rev.snapshot[f];
  }
  Object.assign(
    set,
    prepareContent({ body: String(set.body ?? ""), title: String(set.title ?? article.title), summary: String(set.summary ?? "") }, article.locale),
  );
  const updated = await Article.findOneAndUpdate({ _id: article._id, version }, { $set: set, $inc: { version: 1 } }, { returnDocument: "after", runValidators: true }).select(
    "+bodyText",
  );
  if (!updated) throw conflict("This story was changed by someone else. Reload first.");
  await snapshot(updated, "restore", user);
  return updated;
}

/** Applies one workflow action to one story as part of a bulk request. */
export async function bulkTransitionOne(user: Profile, id: Types.ObjectId, action: "submit" | "unpublish" | "archive") {
  const article = await loadForUser(user, id);
  assertTransitionAllowed(user, article, action);
  const status = action === "submit" ? "in_review" : action === "archive" ? "archived" : "draft";
  const wasPublic = article.status === "published";
  const updated = await Article.findOneAndUpdate(
    { _id: article._id, version: article.version },
    { $set: { status, scheduledFor: null }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw conflict("changed concurrently");
  await snapshot(updated, "transition", user);
  return { updated, wasPublic };
}

/** Scheduled and published stories in a month (newsroom time), for the editorial calendar. */
export async function calendar(user: Profile, year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const from = new Date(`${year}-${mm}-01T00:00:00+06:00`);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const to = new Date(`${next}-01T00:00:00+06:00`);
  const scope: Record<string, unknown> = hasPermission(user.role, "article:edit_any") ? {} : { $or: [{ createdBy: user._id }, { authors: user._id }] };
  const docs = await Article.find({
    ...scope,
    $and: [
      {
        $or: [
          { status: "scheduled", scheduledFor: { $gte: from, $lt: to } },
          { status: "published", publishedAt: { $gte: from, $lt: to } },
        ],
      },
    ],
  })
    .select("locale title status scheduledFor publishedAt")
    .sort({ scheduledFor: 1, publishedAt: 1 })
    .limit(1000)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    locale: d.locale,
    title: d.title,
    status: d.status,
    at: (d.status === "scheduled" ? d.scheduledFor : d.publishedAt)?.toISOString() ?? null,
  }));
}

/** Copies a story into a new, unlinked draft in the same language (no translation link, fresh slug). */
export async function duplicateArticle(user: Profile, id: Types.ObjectId) {
  const source = await loadForUser(user, id);
  const suffix = source.locale === "bn" ? " (কপি)" : " (copy)";
  const title = `${source.title}${suffix}`.slice(0, 220);
  const copy = await Article.create({
    locale: source.locale,
    translationGroup: new Types.ObjectId(),
    status: "draft",
    format: source.format,
    title,
    slug: await uniqueSlug(source.locale, `${source.slug}-${source.locale === "bn" ? "কপি" : "copy"}`),
    summary: source.summary,
    body: source.body,
    bodyText: source.bodyText,
    readingMinutes: source.readingMinutes,
    category: source.category,
    tags: source.tags,
    authors: source.authors.length ? source.authors : [user._id],
    createdBy: user._id,
    featuredImage: source.featuredImage,
    imageAlt: source.imageAlt,
    imageCaption: source.imageCaption,
    imageCredit: source.imageCredit,
    videoUrl: source.videoUrl,
    seo: { title: source.seo?.title, description: source.seo?.description, focusKeyword: source.seo?.focusKeyword },
  });
  await snapshot(copy, "manual", user);
  return copy;
}

/** Ends an active breaking banner immediately (editors). */
export async function endBreaking(user: Profile, id: Types.ObjectId) {
  if (!canCurate(user)) throw forbidden("Only editors can manage breaking banners");
  const updated = await Article.findByIdAndUpdate(id, { $set: { breakingUntil: null }, $inc: { version: 1 } }, { returnDocument: "after" });
  if (!updated) throw notFound("Article");
  return updated;
}
