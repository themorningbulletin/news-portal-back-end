import { Types, type QueryFilter } from "mongoose";
import { escapeRegex } from "../../lib/text.js";
import { Article, type ArticleDoc } from "./article.model.js";
import { Category } from "../category/category.model.js";
import { SiteSettings } from "../settings/settings.model.js";
import { DEFAULT_COUNT, type HomepageBlock } from "../settings/settings.service.js";
import { type ArticleFormat, type Locale } from "../../shared/constants.js";
import { serializeArticleCard, serializeArticleDetail, type LeanArticle } from "./article.serializer.js";
import { serializeCategory, type LeanCategory } from "../category/category.serializer.js";
import { topArticleIds } from "../analytics/analytics.service.js";

export const CARD_FIELDS =
  "locale translationGroup status format title slug summary readingMinutes category authors featuredImage imageAlt imageCaption imageCredit breakingUntil publishedAt contentUpdatedAt";

const CATEGORY_FIELDS = "name slug description parent order";
const AUTHOR_FIELDS = "displayName author.isPublic author.slug author.name";
const MEDIA_FIELDS = "provider url width height alt caption credit focalX focalY";

export function publishedFilter(locale: Locale, now = new Date()): QueryFilter<ArticleDoc> {
  return { locale, status: "published", publishedAt: { $lte: now } };
}

function cardQuery(filter: QueryFilter<ArticleDoc>) {
  return Article.find(filter)
    .select(CARD_FIELDS)
    .populate("category", CATEGORY_FIELDS)
    .populate("authors", AUTHOR_FIELDS)
    .populate("featuredImage", MEDIA_FIELDS);
}

async function cards(filter: QueryFilter<ArticleDoc>, limit: number, skip = 0) {
  const docs = await cardQuery(filter).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit).lean<LeanArticle[]>();
  const now = new Date();
  return docs.map((d) => serializeArticleCard(d, now));
}

export interface ListOptions {
  locale: Locale;
  category?: Types.ObjectId[];
  tag?: Types.ObjectId;
  author?: Types.ObjectId;
  format?: ArticleFormat;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function listArticles(opts: ListOptions) {
  const filter: QueryFilter<ArticleDoc> = publishedFilter(opts.locale);
  if (opts.category?.length) filter.category = { $in: opts.category };
  if (opts.tag) filter.tags = opts.tag;
  if (opts.author) filter.authors = opts.author;
  if (opts.format) filter.format = opts.format;
  if (opts.from || opts.to) {
    filter.publishedAt = {
      $lte: opts.to && opts.to < new Date() ? opts.to : new Date(),
      ...(opts.from ? { $gte: opts.from } : {}),
    };
  }
  const [items, total] = await Promise.all([
    cards(filter, opts.limit, (opts.page - 1) * opts.limit),
    Article.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getPublishedBySlug(locale: Locale, slug: string) {
  const doc = await Article.findOne({ ...publishedFilter(locale), slug })
    .populate("category", CATEGORY_FIELDS)
    .populate("tags", "name slug")
    .populate("authors", AUTHOR_FIELDS)
    .populate("featuredImage", MEDIA_FIELDS)
    .populate("seo.socialImage", MEDIA_FIELDS)
    .lean<LeanArticle>();
  if (!doc) return null;
  const translations = await Article.find({
    translationGroup: doc.translationGroup,
    status: "published",
    publishedAt: { $lte: new Date() },
    _id: { $ne: doc._id },
  })
    .select("locale slug")
    .lean<{ locale: Locale; slug: string }[]>();
  return serializeArticleDetail(
    doc,
    translations.map((t) => ({ locale: t.locale, slug: t.slug })),
  );
}

/** Finds the current slug for a story whose slug was changed after publication. */
export async function resolvePreviousSlug(locale: Locale, slug: string): Promise<string | null> {
  const doc = await Article.findOne({ ...publishedFilter(locale), previousSlugs: slug })
    .select("slug")
    .lean<{ slug: string }>();
  return doc?.slug ?? null;
}

/** Related stories: shared tags first (by overlap), then same category. Never padded with unrelated content. */
export async function relatedArticles(locale: Locale, articleId: string, limit = 4) {
  const base = await Article.findById(articleId).select("tags category").lean<{ tags: Types.ObjectId[]; category?: Types.ObjectId }>();
  if (!base) return [];
  const exclude = [new Types.ObjectId(articleId)];
  const results: ReturnType<typeof serializeArticleCard>[] = [];

  if (base.tags.length) {
    const ranked = await Article.aggregate<{ _id: Types.ObjectId }>([
      { $match: { ...publishedFilter(locale), _id: { $nin: exclude }, tags: { $in: base.tags } } },
      { $addFields: { overlap: { $size: { $setIntersection: ["$tags", base.tags] } } } },
      { $sort: { overlap: -1, publishedAt: -1 } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);
    const ids = ranked.map((r) => r._id);
    const found = await cards({ _id: { $in: ids } }, limit);
    found.sort((a, b) => ids.findIndex((i) => String(i) === a.id) - ids.findIndex((i) => String(i) === b.id));
    results.push(...found);
    exclude.push(...ids);
  }
  if (results.length < limit && base.category) {
    results.push(
      ...(await cards(
        { ...publishedFilter(locale), _id: { $nin: exclude }, category: base.category },
        limit - results.length,
      )),
    );
  }
  return results;
}

export interface SearchOptions {
  locale: Locale;
  q: string;
  category?: Types.ObjectId;
  author?: Types.ObjectId;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

/** Upper bound on matches considered per query, which keeps search cost predictable. */
const SEARCH_CAP = 200;

/**
 * Full-text search on title, summary and body, ranked by relevance. MongoDB's
 * text index matches whole tokens and has no Bangla stemmer, so inflected
 * words ("বাজেটে" for "বাজেট") are added from an escaped substring match on
 * titles and summaries, ranked after the token matches.
 */
export async function searchArticles(opts: SearchOptions) {
  const filter: QueryFilter<ArticleDoc> = publishedFilter(opts.locale);
  if (opts.category) filter.category = opts.category;
  if (opts.author) filter.authors = opts.author;
  if (opts.from || opts.to) {
    filter.publishedAt = { $lte: opts.to && opts.to < new Date() ? opts.to : new Date(), ...(opts.from ? { $gte: opts.from } : {}) };
  }

  const textHits = await Article.find({ ...filter, $text: { $search: opts.q } })
    .select({ _id: 1, score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, publishedAt: -1 })
    .limit(SEARCH_CAP)
    .lean<{ _id: Types.ObjectId }[]>();
  const pattern = new RegExp(escapeRegex(opts.q.normalize("NFC")), "i");
  const substringHits = await Article.find({
    ...filter,
    _id: { $nin: textHits.map((h) => h._id) },
    $or: [{ title: pattern }, { summary: pattern }],
  })
    .select("_id")
    .sort({ publishedAt: -1 })
    .limit(SEARCH_CAP - textHits.length)
    .lean<{ _id: Types.ObjectId }[]>();

  const ids = [...textHits, ...substringHits].map((h) => String(h._id));
  const pageIds = ids.slice((opts.page - 1) * opts.limit, opts.page * opts.limit);
  const docs = await cardQuery({ _id: { $in: pageIds } }).lean<LeanArticle[]>();
  const now = new Date();
  const order = new Map(pageIds.map((id, i) => [id, i]));
  const items = docs
    .sort((a, b) => order.get(String(a._id))! - order.get(String(b._id))!)
    .map((d) => serializeArticleCard(d, now));
  const mode = textHits.length && substringHits.length ? "combined" : substringHits.length ? "substring" : "text";
  return { items, total: ids.length, mode: mode as "text" | "substring" | "combined" };
}

/** Title suggestions for the search box. */
export async function suggestTitles(locale: Locale, q: string, limit = 6) {
  const pattern = new RegExp(escapeRegex(q.normalize("NFC")), "i");
  const docs = await Article.find({ ...publishedFilter(locale), title: pattern })
    .select("title slug")
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<{ title: string; slug: string }[]>();
  return docs.map((d) => ({ title: d.title, slug: d.slug }));
}

/** Most read = total page views counted in the last 7 UTC days (see stats.ts). */
export async function popularArticles(locale: Locale, limit = 10) {
  const rows = await topArticleIds(locale, 7, limit * 2);
  if (rows.length === 0) return [];
  const docs = await cards({ ...publishedFilter(locale), _id: { $in: rows.map((r) => r._id) } }, limit * 2);
  const views = new Map(rows.map((r) => [String(r._id), r.views]));
  return docs
    .map((d) => ({ ...d, views: views.get(d.id) ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export async function breakingArticles(locale: Locale) {
  const now = new Date();
  return cards({ ...publishedFilter(locale, now), breakingUntil: { $gt: now } }, 5);
}

/** Stories under the lead in the homepage's first block. */
const TOP_COUNT = 3;

export async function homepage(locale: Locale) {
  const now = new Date();
  const pub = publishedFilter(locale, now);
  // The lead and top stories never repeat elsewhere; other modules may overlap with the latest feed.
  const prominent: Types.ObjectId[] = [];
  const take = async (filter: QueryFilter<ArticleDoc>, limit: number, decidedAt?: "pinnedAt" | "featuredAt" | "editorsPickAt") => {
    // Editors' choices go by when they were made (stories chosen before this was tracked fall back to their last edit).
    const order: Record<string, 1 | -1> = decidedAt ? { [decidedAt]: -1, updatedAt: -1, _id: -1 } : { publishedAt: -1, _id: -1 };
    const docs = await cardQuery({ ...pub, ...filter, _id: { $nin: prominent } })
      .sort(order)
      .limit(limit)
      .lean<LeanArticle[]>();
    return docs.map((d) => serializeArticleCard(d, now));
  };
  const markProminent = (items: ReturnType<typeof serializeArticleCard>[]) =>
    prominent.push(...items.map((i) => new Types.ObjectId(i.id)));

  const pinned = await take({ pinnedUntil: { $gt: now } }, 1, "pinnedAt");
  const lead = pinned[0] ?? (await take({ isFeatured: true }, 1, "featuredAt"))[0] ?? (await take({}, 1))[0] ?? null;
  if (lead) markProminent([lead]);
  const topFeatured = await take({ isFeatured: true }, TOP_COUNT, "featuredAt");
  markProminent(topFeatured);
  // Under the lead: featured stories, then editors' picks, then the newest.
  const top = [...topFeatured];
  if (top.length < TOP_COUNT) {
    const picks = await take({ isEditorsPick: true }, TOP_COUNT - top.length, "editorsPickAt");
    markProminent(picks);
    top.push(...picks);
  }
  if (top.length < TOP_COUNT) {
    const newest = await take({}, TOP_COUNT - top.length);
    markProminent(newest);
    top.push(...newest);
  }
  const latest = await take({}, 8);
  const editorsPicks = await take({ isEditorsPick: true }, 4, "editorsPickAt");
  const explainers = await take({ format: "explainer" }, 4);
  const visual = await take({ format: { $in: ["photo", "video"] } }, 6);
  const opinion = await take({ format: "opinion" }, 4);

  const settings = await SiteSettings.findOne({ key: "site" })
    .populate<{ homepageSections: (Omit<HomepageBlock, "category"> & { category: LeanCategory | null })[] }>("homepageSections.category", CATEGORY_FIELDS)
    .lean();
  // Blocks in the editors' order. A section with no stories in this language yet is left out
  // (the homepage settings page shows editors which ones); ad blocks always stay.
  const sections: (
    | { kind: "section"; category: ReturnType<typeof serializeCategory>; variant: HomepageBlock["variant"]; width: number; items: ReturnType<typeof serializeArticleCard>[] }
    | { kind: "ad"; width: number }
  )[] = [];
  for (const s of settings?.homepageSections ?? []) {
    const width = s.width ?? 12;
    if (s.kind === "ad") {
      sections.push({ kind: "ad", width });
      continue;
    }
    if (!s.category) continue;
    const children = await Category.find({ parent: s.category._id, isActive: true })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
    const items = await take({ category: { $in: [s.category._id, ...children.map((c) => c._id)] } }, s.count ?? DEFAULT_COUNT[s.variant]);
    if (items.length === 0) continue;
    sections.push({ kind: "section", category: serializeCategory(s.category, locale), variant: s.variant, width, items });
  }

  return {
    breaking: await breakingArticles(locale),
    lead,
    top,
    latest,
    editorsPicks,
    explainers,
    visual,
    opinion,
    sections,
  };
}

/** Stories from the sections and topics a reader follows. */
export async function followedFeed(
  profile: { followedCategories: Types.ObjectId[]; followedTags: Types.ObjectId[] },
  locale: Locale,
  page: number,
  limit: number,
) {
  if (!profile.followedCategories.length && !profile.followedTags.length) return { items: [], total: 0 };
  const filter: QueryFilter<ArticleDoc> = {
    ...publishedFilter(locale),
    $or: [{ category: { $in: profile.followedCategories } }, { tags: { $in: profile.followedTags } }],
  };
  const [items, total] = await Promise.all([cards(filter, limit, (page - 1) * limit), Article.countDocuments(filter)]);
  return { items, total };
}

/** Archive dates follow the newsroom's local day (Bangladesh Standard Time, UTC+6, no DST). */
export const NEWSROOM_UTC_OFFSET = "+06:00";

export function dayRange(day: string) {
  const from = new Date(`${day}T00:00:00${NEWSROOM_UTC_OFFSET}`);
  return { from, to: new Date(from.getTime() + 86_400_000 - 1) };
}

/** Days in a month that have published stories, for the archive calendar. */
export async function archiveDays(locale: Locale, year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const from = new Date(`${year}-${mm}-01T00:00:00${NEWSROOM_UTC_OFFSET}`);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const to = new Date(`${nextMonth}-01T00:00:00${NEWSROOM_UTC_OFFSET}`);
  const rows = await Article.aggregate<{ _id: string; count: number }>([
    { $match: { ...publishedFilter(locale), publishedAt: { $gte: from, $lt: to < new Date() ? to : new Date() } } },
    { $group: { _id: { $dateToString: { date: "$publishedAt", format: "%Y-%m-%d", timezone: NEWSROOM_UTC_OFFSET } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ day: r._id, count: r.count }));
}

export const SITEMAP_PAGE_SIZE = 5000;

/** Canonical, indexable URLs only: published stories, never drafts or stories canonicalised elsewhere. */
export async function sitemapEntries(locale: Locale, page: number, since?: string) {
  const filter = { ...publishedFilter(locale), ...(since ? { publishedAt: { $gte: new Date(since), $lte: new Date() } } : {}) };
  const [docs, total] = await Promise.all([
    Article.find(filter)
      .select("slug title publishedAt contentUpdatedAt updatedAt translationGroup seo.canonicalUrl")
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * SITEMAP_PAGE_SIZE)
      .limit(SITEMAP_PAGE_SIZE)
      .lean(),
    Article.countDocuments(filter),
  ]);
  const other = await Article.find({ ...publishedFilter(locale === "bn" ? "en" : "bn"), translationGroup: { $in: docs.map((d) => d.translationGroup) } })
    .select("slug translationGroup locale")
    .lean();
  const byGroup = new Map(other.map((o) => [String(o.translationGroup), o]));
  const items = docs
    .filter((d) => !d.seo?.canonicalUrl)
    .map((d) => {
      const t = byGroup.get(String(d.translationGroup));
      return {
        slug: d.slug,
        title: d.title,
        publishedAt: d.publishedAt?.toISOString(),
        lastModified: (d.contentUpdatedAt ?? d.publishedAt)?.toISOString(),
        alternate: t ? { locale: t.locale, slug: t.slug } : null,
      };
    });
  return { items, total };
}

export async function findPublishedForView(id: Types.ObjectId) {
  return Article.findOne({ _id: id, status: "published", publishedAt: { $lte: new Date() } }).select("locale").lean();
}
