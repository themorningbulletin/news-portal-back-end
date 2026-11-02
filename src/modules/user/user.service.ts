import type { HydratedDocument, Types } from "mongoose";
import { AppError, forbidden, notFound } from "../../lib/errors.js";
import type { IdentityProvider } from "../../lib/identity.js";
import { logger } from "../../lib/logger.js";
import { hasPermission, isKnownRole, isStaffRole, rolesWith } from "../../lib/permissions.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { escapeRegex } from "../../lib/text.js";
import type { Locale } from "../../shared/constants.js";
import { Bookmark } from "../bookmark/bookmark.model.js";
import { Category } from "../category/category.model.js";
import { serializeCategory } from "../category/category.serializer.js";
import { Tag } from "../tag/tag.model.js";
import { serializeTag } from "../tag/tag.serializer.js";
import { UserProfile, type UserProfileDoc } from "./user.model.js";
import { serializeAuthorProfile, type LeanAuthor } from "./user.serializer.js";
import type { AuthorProfileInput, InviteUserInput, UpdateUserInput } from "./user.validation.js";

export type Profile = HydratedDocument<UserProfileDoc>;

const ADMIN_FIELDS = "email displayName role canPublish disabled author lastLoginAt createdAt";

/** Translates a byline form into dotted $set paths, sanitizing every text field. */
export function authorProfileUpdate(input: AuthorProfileInput) {
  const set: Record<string, unknown> = {};
  if (input.isPublic !== undefined) set["author.isPublic"] = input.isPublic;
  if (input.slug !== undefined) set["author.slug"] = input.slug;
  for (const loc of ["bn", "en"] as const) {
    if (input.name?.[loc] !== undefined) set[`author.name.${loc}`] = sanitizePlain(input.name[loc]!);
    if (input.bio?.[loc] !== undefined) set[`author.bio.${loc}`] = sanitizePlain(input.bio[loc]!);
  }
  if (input.avatarUrl !== undefined) set["author.avatarUrl"] = input.avatarUrl || null;
  return set;
}

/* ---------------- Public bylines ---------------- */

export async function listPublicAuthors(locale: Locale) {
  const docs = await UserProfile.find({ "author.isPublic": true, "author.slug": { $type: "string" } })
    .select("displayName author")
    .sort({ "author.slug": 1 })
    .limit(200)
    .lean<LeanAuthor[]>();
  return docs.map((a) => serializeAuthorProfile(a, locale));
}

export async function getPublicAuthor(locale: Locale, slug: string) {
  const a = await UserProfile.findOne({ "author.slug": slug, "author.isPublic": true }).select("displayName author").lean<LeanAuthor>();
  if (!a) throw notFound("Author");
  return serializeAuthorProfile(a, locale);
}

export async function findPublicAuthorId(slug: string): Promise<Types.ObjectId | null> {
  const a = await UserProfile.findOne({ "author.slug": slug, "author.isPublic": true }).select("_id").lean();
  return a?._id ?? null;
}

/* ---------------- Newsroom administration ---------------- */

export async function listUsers(q: { page: number; limit: number; q?: string; role?: string }) {
  const filter: Record<string, unknown> = {};
  if (q.role) filter.role = q.role;
  if (q.q) {
    const p = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ email: p }, { displayName: p }];
  }
  const [docs, total] = await Promise.all([
    UserProfile.find(filter).select(ADMIN_FIELDS).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    UserProfile.countDocuments(filter),
  ]);
  return { docs, total };
}

/** Active newsroom staff, for byline pickers (no emails). */
export function listStaff() {
  return UserProfile.find({ role: { $in: rolesWith("article:create") }, disabled: false })
    .select("displayName role author.name author.slug")
    .sort({ displayName: 1 })
    .limit(500)
    .lean();
}

/** A sub-admin manages staff, but only an admin can create someone who can manage users. */
function assertMayAssign(actor: Profile, role?: string) {
  if (role && actor.role !== "admin" && hasPermission(role, "users:manage")) {
    throw forbidden("Only an admin can give this role");
  }
}

/**
 * Changes a user's role, publishing permission, status or byline. Guards
 * against locking the newsroom out: admins cannot demote themselves and the
 * last active admin cannot be removed.
 */
export async function updateUser(actor: Profile, id: Types.ObjectId, input: UpdateUserInput) {
  const target = await UserProfile.findById(id);
  if (!target) throw notFound("User");
  if (input.role && !isKnownRole(input.role)) throw new AppError("validation_failed", "Unknown role");
  assertMayAssign(actor, input.role);
  if (actor.role !== "admin" && hasPermission(target.role, "users:manage")) {
    throw forbidden("Only an admin can change an admin or sub-admin account");
  }
  const demotingAdmin = target.role === "admin" && ((input.role && input.role !== "admin") || input.disabled === true);
  if (demotingAdmin) {
    if (String(target._id) === String(actor._id)) throw new AppError("conflict", "You cannot remove your own admin access");
    const admins = await UserProfile.countDocuments({ role: "admin", disabled: false });
    if (admins <= 1) throw new AppError("conflict", "At least one active admin must remain");
  }
  const set: Record<string, unknown> = { ...(input.author ? authorProfileUpdate(input.author) : {}) };
  for (const k of ["role", "canPublish", "disabled"] as const) if (input[k] !== undefined) set[k] = input[k];
  const updated = await UserProfile.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true }).select(ADMIN_FIELDS).lean();
  return {
    before: { role: target.role, canPublish: target.canPublish, disabled: target.disabled },
    updated: updated!,
  };
}

export async function updateOwnByline(actor: Profile, input: AuthorProfileInput) {
  if (!isStaffRole(actor.role)) throw new AppError("forbidden", "Only newsroom staff have bylines");
  return (await UserProfile.findByIdAndUpdate(actor._id, { $set: authorProfileUpdate(input) }, { returnDocument: "after", runValidators: true }).lean())!;
}

/**
 * Gives someone a role by email. A new person gets a Firebase account and a
 * one-time link for choosing their own password, which the admin passes on.
 */
export async function inviteUser(actor: Profile, identity: IdentityProvider, input: InviteUserInput) {
  if (!isKnownRole(input.role)) throw new AppError("validation_failed", "Unknown role");
  assertMayAssign(actor, input.role);
  const existingUid = await identity.findUidByEmail(input.email);
  const uid = existingUid ?? (await identity.createUser(input.email, input.displayName));
  const profile = await UserProfile.findOne({ firebaseUid: uid });
  let user;
  if (profile) {
    user = (await updateUser(actor, profile._id, { role: input.role })).updated;
  } else {
    const created = await UserProfile.create({ firebaseUid: uid, email: input.email, displayName: input.displayName, role: input.role });
    user = created.toObject({ versionKey: false });
  }
  return { user, created: !existingUid, resetLink: existingUid ? null : await identity.passwordResetLink(input.email) };
}

/* ---------------- Reader self-service ---------------- */

export async function updatePreferences(profile: Profile, prefs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(prefs)) profile.set(`preferences.${k}`, v);
  await profile.save();
  return profile;
}

export async function getFollows(profile: Profile, locale: Locale) {
  const [cats, tags] = await Promise.all([
    Category.find({ _id: { $in: profile.followedCategories } }).lean(),
    Tag.find({ _id: { $in: profile.followedTags } }).lean(),
  ]);
  return { categories: cats.map((c) => serializeCategory(c, locale)), tags: tags.map((t) => serializeTag(t, locale)) };
}

/** Replaces followed sections/topics; unknown ids are silently dropped. */
export async function setFollows(profile: Profile, input: { categories: Types.ObjectId[]; tags: Types.ObjectId[] }) {
  const [cats, tags] = await Promise.all([
    Category.find({ _id: { $in: input.categories } }).select("_id").lean(),
    Tag.find({ _id: { $in: input.tags } }).select("_id").lean(),
  ]);
  profile.followedCategories = cats.map((c) => c._id);
  profile.followedTags = tags.map((t) => t._id);
  await profile.save();
  return profile;
}

/** Everything stored about the reader, for download. */
export async function exportAccount(profile: Profile) {
  const bookmarks = await Bookmark.find({ user: profile._id }).select("translationGroup createdAt").lean();
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role,
      preferences: profile.preferences,
      followedCategories: profile.followedCategories.map(String),
      followedTags: profile.followedTags.map(String),
      createdAt: profile.createdAt,
      lastLoginAt: profile.lastLoginAt,
    },
    bookmarks: bookmarks.map((b) => ({ story: String(b.translationGroup), savedAt: b.createdAt })),
  };
}

/** Deletes the reader's data and Firebase sign-in. Staff accounts must be demoted by an admin first. */
export async function deleteAccount(profile: Profile, identity: IdentityProvider) {
  if (isStaffRole(profile.role)) {
    throw new AppError("forbidden", "Staff accounts cannot be self-deleted; ask an administrator");
  }
  await Bookmark.deleteMany({ user: profile._id });
  await UserProfile.deleteOne({ _id: profile._id });
  try {
    await identity.deleteUser(profile.firebaseUid);
  } catch (err) {
    logger.error({ err }, "profile deleted but Firebase user deletion failed");
  }
}
