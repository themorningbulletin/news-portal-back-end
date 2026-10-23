import type { Types } from "mongoose";
import type { Locale, Localized } from "../../shared/constants.js";
import { otherLocale, pick } from "../../shared/localize.js";

export interface LeanTag {
  _id: Types.ObjectId;
  name: Localized;
  slug: Localized;
}

export function serializeTag(t: LeanTag, locale: Locale) {
  return {
    id: String(t._id),
    name: pick(t.name, locale) || pick(t.name, otherLocale(locale)),
    slug: pick(t.slug, locale) || null,
    alternates: { bn: t.slug.bn ?? null, en: t.slug.en ?? null },
  };
}
