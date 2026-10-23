import { createHash, randomBytes } from "node:crypto";
import { env, features } from "../../config/env.js";
import { AppError, forbidden, notFound } from "../../lib/errors.js";
import type { Types } from "mongoose";
import { hasPermission } from "../../lib/permissions.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { escapeRegex } from "../../lib/text.js";
import { Article } from "../article/article.model.js";
import type { Profile } from "../user/user.service.js";
import { Media } from "./media.model.js";
import type { MediaMetaInput, MediaUploadMeta } from "./media.validation.js";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Identify an image by its file signature rather than trusting the filename or declared type. */
export function detectImageType(buf: Buffer): AllowedImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head = buf.subarray(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  const brand = buf.subarray(4, 12).toString("ascii");
  if (brand === "ftypavif" || brand === "ftypavis") return "image/avif";
  return null;
}

export interface UploadedImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export interface MediaStorage {
  enabled(): boolean;
  upload(file: Buffer, type: AllowedImageType): Promise<UploadedImage>;
}

/** Signed server-side upload to Cloudinary; the API secret never reaches the browser. */
export const cloudinaryStorage: MediaStorage = {
  enabled: () => features.mediaUploads(),
  async upload(file, type) {
    const e = env();
    if (!features.mediaUploads(e)) throw new AppError("feature_disabled", "Media storage is not configured");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // Randomized names: uploaded filenames are never used.
    const publicId = randomBytes(12).toString("hex");
    const toSign = `folder=${e.CLOUDINARY_FOLDER}&public_id=${publicId}&timestamp=${timestamp}${e.CLOUDINARY_API_SECRET}`;
    const signature = createHash("sha1").update(toSign).digest("hex");

    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(file)], { type }));
    form.set("api_key", e.CLOUDINARY_API_KEY!);
    form.set("timestamp", timestamp);
    form.set("folder", e.CLOUDINARY_FOLDER);
    form.set("public_id", publicId);
    form.set("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(e.CLOUDINARY_CLOUD_NAME!)}/image/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new AppError("upstream_failed", "The media service rejected the upload");
    const json = (await res.json()) as {
      public_id: string;
      secure_url: string;
      width: number;
      height: number;
      format: string;
      bytes: number;
    };
    return {
      publicId: json.public_id,
      url: json.secure_url,
      width: json.width,
      height: json.height,
      format: json.format,
      bytes: json.bytes,
    };
  },
};

export function allowedImageHosts(): string[] {
  const hosts = ["res.cloudinary.com"];
  try {
    hosts.push(new URL(env().WEB_BASE_URL).hostname);
  } catch {
    // WEB_BASE_URL is validated at startup.
  }
  return hosts;
}

/* ---------------- Media library ---------------- */

/** How many stories use each image (as featured or social image): reuse tracking. */
export async function usageCounts(ids: Types.ObjectId[]) {
  const rows = await Article.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { $or: [{ featuredImage: { $in: ids } }, { "seo.socialImage": { $in: ids } }] } },
    { $project: { refs: { $setUnion: [["$featuredImage"], ["$seo.socialImage"]] } } },
    { $unwind: "$refs" },
    { $match: { refs: { $in: ids } } },
    { $group: { _id: "$refs", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listMedia(q: { page: number; limit: number; q?: string }) {
  const pattern = q.q ? new RegExp(escapeRegex(q.q.normalize("NFC")), "i") : null;
  const filter = pattern ? { $or: [{ "alt.bn": pattern }, { "alt.en": pattern }, { credit: pattern }] } : {};
  const [docs, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Media.countDocuments(filter),
  ]);
  const counts = await usageCounts(docs.map((d) => d._id));
  return { items: docs.map((d) => ({ ...d, id: String(d._id), usageCount: counts.get(String(d._id)) ?? 0 })), total };
}

export async function getMedia(id: Types.ObjectId) {
  const media = await Media.findById(id).lean();
  if (!media) throw notFound("Media");
  const counts = await usageCounts([id]);
  return { ...media, id: String(id), usageCount: counts.get(String(id)) ?? 0 };
}

/** Stores an uploaded image (already verified by signature) and its editorial metadata. */
export async function createMedia(storage: MediaStorage, file: Buffer, type: AllowedImageType, meta: MediaUploadMeta, uploadedBy: Types.ObjectId) {
  const stored = await storage.upload(file, type);
  const media = await Media.create({
    provider: "cloudinary",
    ...stored,
    alt: { bn: sanitizePlain(meta.alt_bn ?? ""), en: sanitizePlain(meta.alt_en ?? "") },
    caption: { bn: sanitizePlain(meta.caption_bn ?? ""), en: sanitizePlain(meta.caption_en ?? "") },
    credit: sanitizePlain(meta.credit ?? ""),
    uploadedBy,
  });
  return { ...media.toObject({ versionKey: false }), id: String(media._id), usageCount: 0 };
}

/** Uploaders edit their own images; editors edit any. Returns published stories that show the image. */
export async function updateMedia(user: Profile, id: Types.ObjectId, input: MediaMetaInput) {
  const media = await Media.findById(id);
  if (!media) throw notFound("Media");
  if (!hasPermission(user.role, "media:manage_any") && String(media.uploadedBy) !== String(user._id)) throw forbidden();
  const set: Record<string, unknown> = {};
  for (const loc of ["bn", "en"] as const) {
    if (input.alt?.[loc] !== undefined) set[`alt.${loc}`] = sanitizePlain(input.alt[loc]!);
    if (input.caption?.[loc] !== undefined) set[`caption.${loc}`] = sanitizePlain(input.caption[loc]!);
  }
  if (input.credit !== undefined) set.credit = sanitizePlain(input.credit);
  if (input.focalX !== undefined) set.focalX = input.focalX;
  if (input.focalY !== undefined) set.focalY = input.focalY;
  const updated = await Media.findByIdAndUpdate(id, { $set: set }, { returnDocument: "after", runValidators: true });
  const affected = await Article.find({ status: "published", $or: [{ featuredImage: id }, { "seo.socialImage": id }] })
    .select("locale slug previousSlugs translationGroup")
    .lean();
  const counts = await usageCounts([id]);
  return { media: { ...updated!.toObject({ versionKey: false }), id: String(id), usageCount: counts.get(String(id)) ?? 0 }, affected };
}
