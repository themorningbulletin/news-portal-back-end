import type { Types } from "mongoose";
import { notFound } from "../../lib/errors.js";
import { sanitizeArticleHtml, sanitizePlain } from "../../lib/sanitize.js";
import type { Locale, PageKey } from "../../shared/constants.js";
import { allowedImageHosts } from "../media/media.service.js";
import { Page } from "./page.model.js";
import type { PageInput } from "./page.validation.js";

export async function getPublished(key: PageKey, locale: Locale) {
  const page = await Page.findOne({ key, locale, status: "published" }).lean();
  if (!page) throw notFound("Page");
  return { key: page.key, locale: page.locale, title: page.title, body: page.body, updatedAt: page.updatedAt.toISOString() };
}

export async function listPublished(locale: Locale) {
  const pages = await Page.find({ locale, status: "published" }).select("key title").lean();
  return pages.map((p) => ({ key: p.key, title: p.title }));
}

export async function listAll() {
  const docs = await Page.find().select("key locale title status updatedAt").lean();
  return docs.map((d) => ({ ...d, id: String(d._id) }));
}

/** The page, or an empty draft shape when it has not been written yet. */
export async function getForEditing(key: PageKey, locale: Locale) {
  const doc = await Page.findOne({ key, locale }).lean();
  return doc ? { ...doc, id: String(doc._id) } : { key, locale, title: "", body: "", status: "draft" as const };
}

export async function save(key: PageKey, locale: Locale, input: PageInput, updatedBy: Types.ObjectId) {
  const doc = await Page.findOneAndUpdate(
    { key, locale },
    {
      $set: {
        title: sanitizePlain(input.title),
        body: sanitizeArticleHtml(input.body, allowedImageHosts()),
        status: input.status,
        updatedBy,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  ).lean();
  return { ...doc!, id: String(doc!._id) };
}
