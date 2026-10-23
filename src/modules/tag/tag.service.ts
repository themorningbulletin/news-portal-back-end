import type { Types } from "mongoose";
import { AppError, conflict, notFound } from "../../lib/errors.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { escapeRegex, slugify, SLUG_PATTERN } from "../../lib/text.js";
import type { Locale } from "../../shared/constants.js";
import { Article } from "../article/article.model.js";
import { publishedFilter } from "../article/article.service.js";
import { Tag } from "./tag.model.js";
import { serializeTag } from "./tag.serializer.js";
import type { TagCreateInput, TagUpdateInput } from "./tag.validation.js";

const clean = (obj: Record<string, string | undefined> | undefined) =>
  Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, sanitizePlain(v!)]));

export async function findIdBySlug(locale: Locale, slug: string): Promise<Types.ObjectId | null> {
  return (await Tag.findOne({ [`slug.${locale}`]: slug }).select("_id").lean())?._id ?? null;
}

export async function getBySlug(locale: Locale, slug: string) {
  const tag = await Tag.findOne({ [`slug.${locale}`]: slug }).lean();
  if (!tag) throw notFound("Tag");
  return serializeTag(tag, locale);
}

/** Topics ordered by how many published stories use them in this language. */
export async function popular(locale: Locale, limit: number) {
  const rows = await Article.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: publishedFilter(locale) },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  const tags = await Tag.find({ _id: { $in: rows.map((r) => r._id) } }).lean();
  const byId = new Map(tags.map((t) => [String(t._id), t]));
  return rows
    .map((row) => {
      const t = byId.get(String(row._id));
      return t ? { ...serializeTag(t, locale), count: row.count } : null;
    })
    .filter((t) => t && t.slug);
}

/* ---------------- Admin ---------------- */

export async function search(q?: string) {
  const pattern = q ? new RegExp(escapeRegex(q.normalize("NFC")), "i") : null;
  const filter = pattern ? { $or: [{ "name.bn": pattern }, { "name.en": pattern }] } : {};
  const docs = await Tag.find(filter).sort({ "name.en": 1 }).limit(200).lean();
  return docs.map((d) => ({ ...d, id: String(d._id) }));
}

/** Creates a tag; a name that already exists in either language is a conflict (the existing id is returned). */
export async function create(input: TagCreateInput) {
  const name = clean(input.name);
  const slug: Record<string, string> = {};
  for (const loc of ["bn", "en"] as const) {
    if (!name[loc]) continue;
    const s = input.slug?.[loc] ?? slugify(name[loc]);
    if (!s || !SLUG_PATTERN.test(s)) throw new AppError("validation_failed", "Invalid tag slug");
    slug[loc] = s;
  }
  const existing = await Tag.findOne({ $or: Object.entries(slug).map(([loc, s]) => ({ [`slug.${loc}`]: s })) }).lean();
  if (existing) throw conflict("A tag with this name already exists", { id: String(existing._id) });
  return Tag.create({ name, slug });
}

export async function update(id: Types.ObjectId, input: TagUpdateInput) {
  const set: Record<string, unknown> = {};
  if (input.name) for (const [k, v] of Object.entries(clean(input.name))) set[`name.${k}`] = v;
  if (input.slug) for (const [k, v] of Object.entries(input.slug)) if (v) set[`slug.${k}`] = v;
  const doc = await Tag.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true });
  if (!doc) throw notFound("Tag");
  return doc;
}

/** Only unused tags can be removed, so no story loses its topics silently. */
export async function remove(id: Types.ObjectId) {
  if (await Article.exists({ tags: id })) throw conflict("This tag is still used by stories");
  const result = await Tag.deleteOne({ _id: id });
  if (!result.deletedCount) throw notFound("Tag");
}
