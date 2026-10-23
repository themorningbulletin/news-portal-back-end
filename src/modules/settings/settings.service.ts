import type { Types } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { Category } from "../category/category.model.js";
import { SiteSettings, type HOMEPAGE_VARIANTS } from "./settings.model.js";

export type HomepageSection = { category: Types.ObjectId; variant: (typeof HOMEPAGE_VARIANTS)[number] };

const view = (sections: HomepageSection[]) => sections.map((s) => ({ category: String(s.category), variant: s.variant }));

export async function getHomepageSections() {
  const s = await SiteSettings.findOne({ key: "site" }).lean();
  return view(s?.homepageSections ?? []);
}

/** Saves the ordered homepage sections; each must be an existing category and appear once. */
export async function saveHomepageSections(sections: HomepageSection[], updatedBy: Types.ObjectId) {
  const ids = sections.map((s) => String(s.category));
  if (new Set(ids).size !== ids.length) throw new AppError("validation_failed", "Each section can appear once");
  if ((await Category.countDocuments({ _id: { $in: sections.map((s) => s.category) } })) !== ids.length) {
    throw new AppError("validation_failed", "Unknown category");
  }
  await SiteSettings.updateOne({ key: "site" }, { $set: { homepageSections: sections, updatedBy }, $setOnInsert: { key: "site" } }, { upsert: true });
  return view(sections);
}
