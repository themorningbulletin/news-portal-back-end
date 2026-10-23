import type { Types } from "mongoose";
import { ArticleDailyStat, ReferrerDailyStat } from "./analytics.model.js";
import { type Locale } from "../../shared/constants.js";

/** Aggregated statistics are kept for about 13 months, then removed by a TTL index. */
const RETENTION_DAYS = 400;

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(n: number, from = new Date()): string {
  return utcDay(new Date(from.getTime() - n * 86_400_000));
}

const expiry = () => new Date(Date.now() + RETENTION_DAYS * 86_400_000);

/**
 * Counts one article view. Nothing personal is stored: no IP, no user id,
 * no cookie. Only per-day totals per article and per referring host.
 */
export async function recordView(articleId: Types.ObjectId, locale: Locale, referrerHost?: string): Promise<void> {
  const day = utcDay();
  await ArticleDailyStat.updateOne(
    { article: articleId, day },
    { $inc: { views: 1 }, $setOnInsert: { locale, expiresAt: expiry() } },
    { upsert: true },
  );
  if (referrerHost) {
    await ReferrerDailyStat.updateOne(
      { day, host: referrerHost },
      { $inc: { views: 1 }, $setOnInsert: { expiresAt: expiry() } },
      { upsert: true },
    );
  }
}

/** Views per article over the last `days` days, highest first. */
export async function topArticleIds(locale: Locale, days: number, limit: number) {
  const rows = await ArticleDailyStat.aggregate<{ _id: Types.ObjectId; views: number }>([
    { $match: { locale, day: { $gte: daysAgo(days - 1) } } },
    { $group: { _id: "$article", views: { $sum: "$views" } } },
    { $sort: { views: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows;
}

export function normalizeReferrer(raw: string | undefined, ownHost: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === ownHost.replace(/^www\./, "") || host.length > 253) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

/** Total views per article over the last `days` UTC days (articles without views are absent). */
export async function viewsByArticle(ids: Types.ObjectId[], days: number): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await ArticleDailyStat.aggregate<{ _id: Types.ObjectId; views: number }>([
    { $match: { article: { $in: ids }, day: { $gte: daysAgo(days - 1) } } },
    { $group: { _id: "$article", views: { $sum: "$views" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.views]));
}
