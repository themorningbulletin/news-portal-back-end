import type { Types } from "mongoose";
import type { Locale, Localized } from "../../shared/constants.js";
import { pick } from "../../shared/localize.js";

export interface LeanMedia {
  _id: Types.ObjectId;
  provider: "cloudinary" | "static";
  url: string;
  width: number;
  height: number;
  alt?: Localized;
  caption?: Localized;
  credit?: string;
  focalX?: number;
  focalY?: number;
}

export function serializeImage(
  media: LeanMedia | null | undefined,
  locale: Locale,
  overrides: { alt?: string; caption?: string; credit?: string } = {},
) {
  if (!media) return null;
  return {
    id: String(media._id),
    provider: media.provider,
    url: media.url,
    width: media.width,
    height: media.height,
    alt: overrides.alt || pick(media.alt, locale),
    caption: overrides.caption || pick(media.caption, locale),
    credit: overrides.credit || media.credit || "",
    focalX: media.focalX ?? 50,
    focalY: media.focalY ?? 50,
  };
}
