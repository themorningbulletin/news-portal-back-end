import type { Types } from "mongoose";
import { env } from "../../config/env.js";
import { PAGE_KEYS, type Locale } from "../../shared/constants.js";
import { Article } from "../article/article.model.js";
import { publishedFilter } from "../article/article.service.js";
import { Category } from "../category/category.model.js";
import { Media } from "../media/media.model.js";
import { Page } from "../page/page.model.js";
import { UserProfile } from "../user/user.model.js";
import { analyzeSeo, type SeoAnalysis } from "./seo.analyzer.js";

/** The site-wide audit reads at most this many published stories per request. */
const AUDIT_LIMIT = 3000;

const site = () => {
  const base = env().WEB_BASE_URL;
  return { base, host: new URL(base).host };
};
const ownUrl = (locale: Locale, slug: string) => `${site().base}/${locale}/news/${encodeURIComponent(slug)}`;
const key = (locale: string, s: string) => `${locale}|${s.normalize("NFC").trim().toLowerCase()}`;

export interface DraftInput {
  id?: Types.ObjectId;
  locale: Locale;
  title: string;
  slug: string;
  summary?: string;
  body?: string;
  seo?: { title?: string; description?: string; canonicalUrl?: string; focusKeyword?: string };
  featuredImage?: Types.ObjectId | null;
  imageAlt?: string;
  tags?: Types.ObjectId[];
  category?: Types.ObjectId | null;
}

/** Live analysis for the editor, including duplicate checks against other published stories. */
export async function analyzeDraft(input: DraftInput): Promise<SeoAnalysis> {
  const [media, existing, dupTitle, dupDesc] = await Promise.all([
    input.featuredImage ? Media.findById(input.featuredImage).select("alt").lean() : null,
    input.id ? Article.findById(input.id).select("translationGroup").lean() : null,
    input.title
      ? Article.exists({ ...publishedFilter(input.locale), _id: { $ne: input.id }, title: (input.seo?.title || input.title).trim() })
      : null,
    input.seo?.description ? Article.exists({ ...publishedFilter(input.locale), _id: { $ne: input.id }, "seo.description": input.seo.description.trim() }) : null,
  ]);
  const hasTranslation = existing ? Boolean(await Article.exists({ translationGroup: existing.translationGroup, _id: { $ne: input.id } })) : false;
  return analyzeSeo(
    {
      locale: input.locale,
      title: input.title,
      slug: input.slug,
      summary: input.summary ?? "",
      body: input.body ?? "",
      seoTitle: input.seo?.title,
      seoDescription: input.seo?.description,
      canonicalUrl: input.seo?.canonicalUrl,
      focusKeyword: input.seo?.focusKeyword,
      hasImage: Boolean(input.featuredImage),
      imageAlt: input.imageAlt || media?.alt?.[input.locale],
      tagCount: input.tags?.length ?? 0,
      hasCategory: Boolean(input.category),
      hasTranslation,
      ownUrl: ownUrl(input.locale, input.slug),
      siteHost: site().host,
    },
    { duplicateTitle: Boolean(dupTitle), duplicateDescription: Boolean(dupDesc) },
  );
}

interface AuditRow {
  id: string;
  locale: Locale;
  title: string;
  slug: string;
  publishedAt: string | null;
  score: number;
  grade: SeoAnalysis["grade"];
  issues: { id: string; status: "warn" | "bad" }[];
}

/** Analyses every published story (up to AUDIT_LIMIT) with site-wide context. */
async function auditArticles(): Promise<AuditRow[]> {
  const docs = await Article.find({ status: "published", publishedAt: { $lte: new Date() } })
    .select("locale title slug summary body seo featuredImage imageAlt tags category translationGroup publishedAt")
    .sort({ publishedAt: -1 })
    .limit(AUDIT_LIMIT)
    .lean();

  const titleCount = new Map<string, number>();
  const descCount = new Map<string, number>();
  const groupCount = new Map<string, number>();
  for (const d of docs) {
    const t = key(d.locale, d.seo?.title || d.title);
    titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
    if (d.seo?.description) {
      const k = key(d.locale, d.seo.description);
      descCount.set(k, (descCount.get(k) ?? 0) + 1);
    }
    groupCount.set(String(d.translationGroup), (groupCount.get(String(d.translationGroup)) ?? 0) + 1);
  }
  const mediaIds = docs.map((d) => d.featuredImage).filter(Boolean) as Types.ObjectId[];
  const media = await Media.find({ _id: { $in: mediaIds } }).select("alt").lean();
  const altById = new Map(media.map((m) => [String(m._id), m.alt ?? {}]));

  return docs.map((d) => {
    const analysis = analyzeSeo(
      {
        locale: d.locale,
        title: d.title,
        slug: d.slug,
        summary: d.summary ?? "",
        body: d.body ?? "",
        seoTitle: d.seo?.title,
        seoDescription: d.seo?.description,
        canonicalUrl: d.seo?.canonicalUrl,
        focusKeyword: d.seo?.focusKeyword,
        hasImage: Boolean(d.featuredImage),
        imageAlt: d.imageAlt || (d.featuredImage ? altById.get(String(d.featuredImage))?.[d.locale] : undefined),
        tagCount: d.tags.length,
        hasCategory: Boolean(d.category),
        hasTranslation: (groupCount.get(String(d.translationGroup)) ?? 0) > 1,
        ownUrl: ownUrl(d.locale, d.slug),
        siteHost: site().host,
      },
      {
        duplicateTitle: (titleCount.get(key(d.locale, d.seo?.title || d.title)) ?? 0) > 1,
        duplicateDescription: d.seo?.description ? (descCount.get(key(d.locale, d.seo.description)) ?? 0) > 1 : false,
      },
    );
    return {
      id: String(d._id),
      locale: d.locale,
      title: d.title,
      slug: d.slug,
      publishedAt: d.publishedAt?.toISOString() ?? null,
      score: analysis.score,
      grade: analysis.grade,
      issues: analysis.checks.filter((c) => c.status !== "good").map((c) => ({ id: c.id, status: c.status as "warn" | "bad" })),
    };
  });
}

/** Site-wide SEO health: story scores, common issues, sections, trust pages and bylines. */
export async function overview() {
  const rows = await auditArticles();
  const issueCounts: Record<string, { warn: number; bad: number }> = {};
  for (const r of rows) for (const i of r.issues) (issueCounts[i.id] ??= { warn: 0, bad: 0 })[i.status]++;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;

  const [categories, catCounts, pages, authors] = await Promise.all([
    Category.find({ isActive: true }).select("name slug description").lean(),
    Article.aggregate<{ _id: { category: Types.ObjectId; locale: Locale }; count: number }>([
      { $match: { status: "published" } },
      { $group: { _id: { category: "$category", locale: "$locale" }, count: { $sum: 1 } } },
    ]),
    Page.find({ status: "published" }).select("key locale").lean(),
    UserProfile.find({ "author.isPublic": true }).select("displayName author").lean(),
  ]);
  const countFor = (id: Types.ObjectId, locale: Locale) =>
    catCounts.find((c) => String(c._id.category) === String(id) && c._id.locale === locale)?.count ?? 0;

  const sectionIssues = categories.flatMap((c) =>
    (["bn", "en"] as const).flatMap((locale) => {
      const issues: string[] = [];
      if (!c.description?.[locale]) issues.push("missing_description");
      if (countFor(c._id, locale) === 0) issues.push("empty_section");
      return issues.length ? [{ id: String(c._id), locale, name: c.name[locale], slug: c.slug[locale], issues }] : [];
    }),
  );

  const trustPages = PAGE_KEYS.map((k) => ({
    key: k,
    bn: pages.some((p) => p.key === k && p.locale === "bn"),
    en: pages.some((p) => p.key === k && p.locale === "en"),
  }));
  const authorIssues = authors
    .filter((a) => !a.author?.bio?.bn || !a.author?.bio?.en || !a.author?.slug)
    .map((a) => ({ id: String(a._id), name: a.author?.name?.en || a.author?.name?.bn || a.displayName || "", missingBio: !a.author?.bio?.bn || !a.author?.bio?.en }));

  return {
    summary: {
      analysed: rows.length,
      averageScore: avg,
      good: rows.filter((r) => r.grade === "good").length,
      fair: rows.filter((r) => r.grade === "fair").length,
      poor: rows.filter((r) => r.grade === "poor").length,
      byLocale: { bn: rows.filter((r) => r.locale === "bn").length, en: rows.filter((r) => r.locale === "en").length },
      limit: AUDIT_LIMIT,
    },
    issueCounts,
    sectionIssues,
    trustPages,
    authorIssues,
  };
}

/** Paged, filterable list of story scores for the dashboard table. */
export async function listScores(q: { locale?: Locale; issue?: string; grade?: string; sort: "score" | "recent"; page: number; limit: number }) {
  let rows = await auditArticles();
  if (q.locale) rows = rows.filter((r) => r.locale === q.locale);
  if (q.issue) rows = rows.filter((r) => r.issues.some((i) => i.id === q.issue));
  if (q.grade) rows = rows.filter((r) => r.grade === q.grade);
  if (q.sort === "score") rows.sort((a, b) => a.score - b.score);
  const total = rows.length;
  return { items: rows.slice((q.page - 1) * q.limit, q.page * q.limit), total };
}
