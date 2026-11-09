import { Types } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { Article } from "../article/article.model.js";
import { Category } from "../category/category.model.js";
import { SiteSettings, SOCIAL_KEYS, type HomepageBlockDoc, type SocialLinks } from "./settings.model.js";

export type HomepageBlock = HomepageBlockDoc;

/** Stories a block would show by default when no count is set. */
export const DEFAULT_COUNT: Record<HomepageBlock["variant"], number> = { feature: 5, side: 3, center: 5, trio: 4, grid: 4, list: 4, mosaic: 4 };

const view = (blocks: HomepageBlock[]) =>
  blocks.map((b) => ({
    kind: b.kind ?? "section",
    category: b.category ? String(b.category) : null,
    variant: b.variant,
    width: b.width ?? 12,
    count: b.count ?? null,
  }));

/** Published stories per language in each block's section (and its subsections), so editors see why a block may stay hidden. */
async function publishedCounts(blocks: ReturnType<typeof view>) {
  const out: Record<string, { bn: number; en: number }> = {};
  const now = new Date();
  for (const b of blocks) {
    if (!b.category || out[b.category]) continue;
    const children = await Category.find({ parent: b.category }).select("_id").lean<{ _id: Types.ObjectId }[]>();
    const ids = [b.category, ...children.map((c) => String(c._id))];
    const rows = await Article.aggregate<{ _id: "bn" | "en"; n: number }>([
      { $match: { status: "published", publishedAt: { $lte: now }, category: { $in: ids.map((i) => new Types.ObjectId(i)) } } },
      { $group: { _id: "$locale", n: { $sum: 1 } } },
    ]);
    out[b.category] = { bn: rows.find((r) => r._id === "bn")?.n ?? 0, en: rows.find((r) => r._id === "en")?.n ?? 0 };
  }
  return out;
}

export async function getHomepageSections() {
  const s = await SiteSettings.findOne({ key: "site" }).lean();
  const blocks = view(s?.homepageSections ?? []);
  return { sections: blocks, published: await publishedCounts(blocks) };
}

/** Saves the ordered homepage blocks; every section block must name an existing category, once. */
export async function saveHomepageSections(blocks: HomepageBlock[], updatedBy: Types.ObjectId) {
  const sections = blocks.filter((b) => b.kind === "section");
  if (sections.some((b) => !b.category)) throw new AppError("validation_failed", "Choose a section for every section block");
  const ids = sections.map((s) => String(s.category));
  if (new Set(ids).size !== ids.length) throw new AppError("validation_failed", "Each section can appear once");
  if ((await Category.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new AppError("validation_failed", "Unknown category");
  }
  const clean = blocks.map((b) => (b.kind === "ad" ? { kind: "ad" as const, category: null, variant: "grid" as const, width: b.width, count: null } : b));
  await SiteSettings.updateOne({ key: "site" }, { $set: { homepageSections: clean, updatedBy }, $setOnInsert: { key: "site" } }, { upsert: true });
  return view(clean);
}

export async function getSocialLinks(): Promise<SocialLinks> {
  const s = await SiteSettings.findOne({ key: "site" }).select("social").lean();
  const social: SocialLinks = {};
  for (const k of SOCIAL_KEYS) if (s?.social?.[k]) social[k] = s.social[k];
  return social;
}

export async function saveSocialLinks(links: SocialLinks, updatedBy: Types.ObjectId) {
  const set: Record<string, string> = {};
  for (const k of SOCIAL_KEYS) set[`social.${k}`] = links[k] ?? "";
  await SiteSettings.updateOne({ key: "site" }, { $set: { ...set, updatedBy }, $setOnInsert: { key: "site" } }, { upsert: true });
  return getSocialLinks();
}
