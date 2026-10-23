import type { Types } from "mongoose";
import { AppError, notFound } from "../../lib/errors.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import type { Locale } from "../../shared/constants.js";
import { Article } from "../article/article.model.js";
import { Category } from "./category.model.js";
import { serializeCategory, type LeanCategory } from "./category.serializer.js";
import type { CategoryInput, CategoryUpdateInput } from "./category.validation.js";

const clean = (obj: Record<string, string | undefined> | undefined) =>
  Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, sanitizePlain(v!)]));

/** A section and its active subsections, by localized slug. */
export async function findBySlugWithChildren(locale: Locale, slug: string): Promise<{ category: LeanCategory; ids: Types.ObjectId[] } | null> {
  const category = await Category.findOne({ [`slug.${locale}`]: slug, isActive: true }).lean<LeanCategory>();
  if (!category) return null;
  const children = await Category.find({ parent: category._id, isActive: true }).select("_id").lean<{ _id: Types.ObjectId }[]>();
  return { category, ids: [category._id, ...children.map((c) => c._id)] };
}

export async function findIdBySlug(locale: Locale, slug: string): Promise<Types.ObjectId | null> {
  return (await Category.findOne({ [`slug.${locale}`]: slug }).select("_id").lean())?._id ?? null;
}

export async function listActive(locale: Locale) {
  const docs = await Category.find({ isActive: true }).sort({ order: 1, _id: 1 }).lean<LeanCategory[]>();
  return docs.map((c) => serializeCategory(c, locale));
}

export async function getDetail(locale: Locale, slug: string) {
  const found = await findBySlugWithChildren(locale, slug);
  if (!found) throw notFound("Category");
  const children = await Category.find({ parent: found.category._id, isActive: true }).sort({ order: 1 }).lean<LeanCategory[]>();
  const parent = found.category.parent ? await Category.findById(found.category.parent).lean<LeanCategory>() : null;
  return {
    ...serializeCategory(found.category, locale),
    parent: parent ? serializeCategory(parent, locale) : null,
    children: children.map((c) => serializeCategory(c, locale)),
  };
}

/* ---------------- Admin ---------------- */

export async function listAllWithCounts() {
  const docs = await Category.find().sort({ order: 1, _id: 1 }).lean();
  const counts = await Article.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  return docs.map((d) => ({ ...d, id: String(d._id), articleCount: byId.get(String(d._id)) ?? 0 }));
}

async function assertTopLevelParent(parent: Types.ObjectId | null | undefined) {
  if (parent && !(await Category.exists({ _id: parent, parent: null }))) {
    throw new AppError("validation_failed", "Parent must be an existing top-level section");
  }
}

export async function create(input: CategoryInput) {
  await assertTopLevelParent(input.parent);
  return Category.create({ ...input, name: clean(input.name), description: clean(input.description) });
}

/** Sections nest one level deep: a subsection cannot have children. */
export async function update(id: Types.ObjectId, input: CategoryUpdateInput) {
  if (input.parent && String(input.parent) === String(id)) throw new AppError("validation_failed", "A section cannot be its own parent");
  await assertTopLevelParent(input.parent);
  if (input.parent && (await Category.exists({ parent: id }))) {
    throw new AppError("validation_failed", "A section with subsections cannot become a subsection");
  }
  const set: Record<string, unknown> = {};
  if (input.name) for (const [k, v] of Object.entries(clean(input.name))) set[`name.${k}`] = v;
  if (input.slug) for (const [k, v] of Object.entries(input.slug)) set[`slug.${k}`] = v;
  if (input.description) for (const [k, v] of Object.entries(clean(input.description))) set[`description.${k}`] = v;
  for (const k of ["parent", "order", "isActive"] as const) if (input[k] !== undefined) set[k] = input[k];
  const doc = await Category.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true });
  if (!doc) throw notFound("Category");
  return doc;
}
