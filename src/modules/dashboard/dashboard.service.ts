import type { Types } from "mongoose";
import { hasPermission } from "../../lib/permissions.js";
import { ArticleDailyStat, ReferrerDailyStat } from "../analytics/analytics.model.js";
import { daysAgo } from "../analytics/analytics.service.js";
import { Article } from "../article/article.model.js";
import { subscriberCounts } from "../newsletter/newsletter.service.js";
import type { Profile } from "../user/user.service.js";

const LIST_FIELDS = "locale title status updatedAt scheduledFor publishedAt";
const asList = (rows: { _id: unknown }[]) => rows.map((x) => ({ ...x, id: String(x._id) }));

/** Readership numbers, shown to editors only. No personal data is involved. */
async function traffic() {
  const from = daysAgo(13);
  const [daily, top, referrers, newsletter] = await Promise.all([
    ArticleDailyStat.aggregate<{ _id: string; views: number }>([
      { $match: { day: { $gte: from } } },
      { $group: { _id: "$day", views: { $sum: "$views" } } },
      { $sort: { _id: 1 } },
    ]),
    ArticleDailyStat.aggregate<{ _id: Types.ObjectId; views: number }>([
      { $match: { day: { $gte: daysAgo(6) } } },
      { $group: { _id: "$article", views: { $sum: "$views" } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
    ReferrerDailyStat.aggregate<{ _id: string; views: number }>([
      { $match: { day: { $gte: daysAgo(6) } } },
      { $group: { _id: "$host", views: { $sum: "$views" } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
    subscriberCounts(),
  ]);
  const titles = await Article.find({ _id: { $in: top.map((t) => t._id) } }).select("title locale slug").lean();
  const byId = new Map(titles.map((t) => [String(t._id), t]));
  return {
    definition: "Article page views, counted once per browser session; no personal data is stored.",
    daily: daily.map((d) => ({ day: d._id, views: d.views })),
    topStories: top.map((t) => ({ id: String(t._id), views: t.views, ...(byId.get(String(t._id)) ?? {}) })),
    referrers: referrers.map((x) => ({ host: x._id, views: x.views })),
    newsletter,
  };
}

/** Workflow queues, content-health warnings and publishing activity, scoped to the user's own work for authors. */
export async function dashboardFor(user: Profile) {
  const scope: Record<string, unknown> = hasPermission(user.role, "article:edit_any") ? {} : { $or: [{ createdBy: user._id }, { authors: user._id }] };

  const [statusCounts, inReview, scheduled, recentlyUpdated, missingMeta] = await Promise.all([
    Article.aggregate<{ _id: string; count: number }>([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Article.find({ ...scope, status: "in_review" }).select(LIST_FIELDS).sort({ updatedAt: 1 }).limit(10).lean(),
    Article.find({ ...scope, status: "scheduled" }).select(LIST_FIELDS).sort({ scheduledFor: 1 }).limit(10).lean(),
    Article.find(scope).select(LIST_FIELDS).sort({ updatedAt: -1 }).limit(10).lean(),
    // Published stories missing metadata that readers and search engines rely on.
    Article.find({
      ...scope,
      status: "published",
      $or: [{ "seo.description": { $in: [null, ""] } }, { featuredImage: null }, { tags: { $size: 0 } }],
    })
      .select(LIST_FIELDS + " seo.description featuredImage tags")
      .sort({ publishedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const since = new Date(Date.now() - 14 * 86_400_000);
  const activity = await Article.aggregate<{ _id: string; count: number }>([
    { $match: { ...scope, firstPublishedAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { date: "$firstPublishedAt", format: "%Y-%m-%d", timezone: "+06:00" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const now = new Date();
  const homepageControls = await Article.find({
    status: "published",
    $or: [{ breakingUntil: { $gt: now } }, { pinnedUntil: { $gt: now } }],
  })
    .select("locale title breakingUntil pinnedUntil")
    .limit(20)
    .lean();

  return {
    homepageControls: homepageControls.map((a) => ({
      id: String(a._id),
      locale: a.locale,
      title: a.title,
      breakingUntil: a.breakingUntil && a.breakingUntil > now ? a.breakingUntil.toISOString() : null,
      pinnedUntil: a.pinnedUntil && a.pinnedUntil > now ? a.pinnedUntil.toISOString() : null,
    })),
    counts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    inReview: asList(inReview),
    scheduled: asList(scheduled),
    recentlyUpdated: asList(recentlyUpdated),
    healthWarnings: asList(missingMeta),
    publicationActivity: activity.map((a) => ({ day: a._id, count: a.count })),
    traffic: hasPermission(user.role, "article:edit_any") ? await traffic() : null,
  };
}
