import type { Types } from "mongoose";
import { AppError, notFound } from "../../lib/errors.js";
import type { Locale } from "../../shared/constants.js";
import { Article } from "../article/article.model.js";
import { serializeArticleCard, type LeanArticle } from "../article/article.serializer.js";
import { CARD_FIELDS } from "../article/article.service.js";
import { Bookmark } from "./bookmark.model.js";

const MAX_BOOKMARKS = 1000;

export async function bookmarkIds(user: Types.ObjectId): Promise<string[]> {
  const rows = await Bookmark.find({ user }).select("translationGroup").limit(MAX_BOOKMARKS).lean();
  return rows.map((b) => String(b.translationGroup));
}

/** Saved stories in the reader's language, falling back to the other version of the same story. */
export async function listBookmarks(user: Types.ObjectId, locale: Locale, page: number, limit: number) {
  const filter = { user };
  const [rows, total] = await Promise.all([
    Bookmark.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Bookmark.countDocuments(filter),
  ]);
  const groups = rows.map((b) => b.translationGroup);
  const docs = await Article.find({ translationGroup: { $in: groups }, status: "published", publishedAt: { $lte: new Date() } })
    .select(CARD_FIELDS)
    .populate("category", "name slug")
    .populate("authors", "displayName author.isPublic author.slug author.name")
    .populate("featuredImage", "provider url width height alt caption credit focalX focalY")
    .lean<LeanArticle[]>();
  const items = groups
    .map((g) => {
      const versions = docs.filter((d) => String(d.translationGroup) === String(g));
      const chosen = versions.find((d) => d.locale === locale) ?? versions[0];
      return chosen ? serializeArticleCard(chosen) : null;
    })
    .filter(Boolean);
  return { items, total };
}

/** Idempotent: saving twice keeps one bookmark. */
export async function addBookmark(user: Types.ObjectId, group: Types.ObjectId) {
  if (!(await Article.exists({ translationGroup: group, status: "published" }))) throw notFound("Article");
  if ((await Bookmark.countDocuments({ user })) >= MAX_BOOKMARKS) throw new AppError("conflict", "Bookmark limit reached");
  await Bookmark.updateOne({ user, translationGroup: group }, { $setOnInsert: { user, translationGroup: group } }, { upsert: true });
}

export async function removeBookmark(user: Types.ObjectId, group: Types.ObjectId) {
  await Bookmark.deleteOne({ user, translationGroup: group });
}
