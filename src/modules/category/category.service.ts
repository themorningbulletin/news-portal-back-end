import type { Types } from "mongoose";
import { AppError, notFound } from "../../lib/errors.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { slugify } from "../../lib/text.js";
import { SiteSettings } from "../settings/settings.model.js";
import { UserProfile } from "../user/user.model.js";
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

/** A web address made from the name (or the one given), with -2, -3… added if another section already uses it. */
async function uniqueSlug(locale: Locale, wanted: string, excludeId?: Types.ObjectId) {
  const base = slugify(wanted) || "section";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 115)}-${n}`;
    const taken = await Category.exists({ [`slug.${locale}`]: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!taken) return candidate;
  }
}

export async function create(input: CategoryInput) {
  await assertTopLevelParent(input.parent);
  const name = clean(input.name) as { bn: string; en: string };
  const slug = {
    bn: await uniqueSlug("bn", input.slug?.bn || name.bn),
    en: await uniqueSlug("en", input.slug?.en || name.en),
  };
  return Category.create({ ...input, name, slug, description: clean(input.description) });
}

/**
 * Deletes a section. Subsections must be moved or deleted first. Its stories are moved
 * to `moveTo` (required when it has any), and it leaves the homepage layout and
 * readers' followed sections.
 */
export async function remove(id: Types.ObjectId, moveTo?: Types.ObjectId) {
  const doc = await Category.findById(id);
  if (!doc) throw notFound("Category");
  if (await Category.exists({ parent: id })) {
    throw new AppError("validation_failed", "This section has subsections. Delete them or move them to another section first.");
  }
  const stories = await Article.countDocuments({ category: id });
  if (stories > 0) {
    if (!moveTo) throw new AppError("validation_failed", "Choose a section to move this section's stories to.", { stories });
    if (String(moveTo) === String(id) || !(await Category.exists({ _id: moveTo }))) throw new AppError("validation_failed", "Choose another existing section");
    await Article.updateMany({ category: id }, { $set: { category: moveTo } });
  }
  await SiteSettings.updateOne({ key: "site" }, { $pull: { homepageSections: { category: id } } });
  await UserProfile.updateMany({ followedCategories: id }, { $pull: { followedCategories: id } });
  await doc.deleteOne();
  return { moved: stories, name: doc.name.en };
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
  if (input.slug) {
    for (const k of ["bn", "en"] as const) {
      const wanted = input.slug[k] || input.name?.[k];
      if (wanted) set[`slug.${k}`] = await uniqueSlug(k, wanted, id);
    }
  }
  if (input.description) for (const [k, v] of Object.entries(clean(input.description))) set[`description.${k}`] = v;
  for (const k of ["parent", "order", "isActive"] as const) if (input[k] !== undefined) set[k] = input[k];
  const doc = await Category.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true });
  if (!doc) throw notFound("Category");
  return doc;
}
