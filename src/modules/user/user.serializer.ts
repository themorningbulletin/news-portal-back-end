import type { Types } from "mongoose";
import { permissionsFor } from "../../lib/permissions.js";
import type { Locale, Localized } from "../../shared/constants.js";
import { otherLocale, pick } from "../../shared/localize.js";
import type { UserProfileDoc } from "./user.model.js";

export interface LeanAuthor {
  _id: Types.ObjectId;
  displayName?: string;
  author?: { isPublic?: boolean; slug?: string; name?: Localized; bio?: Localized; avatarUrl?: string };
}

/** Public byline: the slug is exposed only when the author page is public. */
export function serializeAuthor(a: LeanAuthor, locale: Locale) {
  const name = pick(a.author?.name, locale) || pick(a.author?.name, otherLocale(locale)) || a.displayName || "";
  return { id: String(a._id), name, slug: a.author?.isPublic ? (a.author.slug ?? null) : null };
}

export function serializeAuthorProfile(a: LeanAuthor, locale: Locale) {
  return {
    ...serializeAuthor(a, locale),
    bio: pick(a.author?.bio, locale) || pick(a.author?.bio, otherLocale(locale)),
    avatarUrl: a.author?.avatarUrl ?? null,
  };
}

/** The signed-in user's own profile and effective permissions. */
export function serializeMe(p: UserProfileDoc) {
  return {
    id: String(p._id),
    email: p.email ?? null,
    displayName: p.displayName ?? null,
    role: p.role,
    canPublish: p.canPublish,
    permissions: permissionsFor(p.role),
    author: {
      isPublic: p.author?.isPublic ?? false,
      slug: p.author?.slug ?? null,
      name: p.author?.name ?? {},
      bio: p.author?.bio ?? {},
    },
    preferences: p.preferences,
    followedCategories: p.followedCategories.map(String),
    followedTags: p.followedTags.map(String),
  };
}

/** Staff list rows and admin views add a string id next to the document. */
export const withId = <T extends { _id: unknown }>(u: T) => ({ ...u, id: String(u._id) });
