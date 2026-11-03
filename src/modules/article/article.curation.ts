import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, notFound } from "../../lib/errors.js";
import { localeSchema, objectId, parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import type { Locale } from "../../shared/constants.js";
import { audit } from "../audit/audit.service.js";
import { revalidationTags } from "./article.editorial.js";
import { Article } from "./article.model.js";
import { homepage } from "./article.service.js";

/*
 * Homepage controls in one place: what is pinned, featured, picked or
 * flagged as breaking, in the order the homepage uses, and which of those
 * readers can see right now.
 */

const FIELDS = "locale title slug status category publishedAt updatedAt pinnedUntil pinnedAt isFeatured featuredAt isEditorsPick editorsPickAt breakingUntil";

type Row = {
  _id: unknown;
  locale: Locale;
  title: string;
  slug: string;
  status: string;
  category?: { _id: unknown; name?: { bn?: string; en?: string } } | null;
  publishedAt?: Date | null;
  pinnedUntil?: Date | null;
  pinnedAt?: Date;
  featuredAt?: Date;
  editorsPickAt?: Date;
  breakingUntil?: Date | null;
};

const view = (a: Row) => ({
  id: String(a._id),
  title: a.title,
  slug: a.slug,
  status: a.status,
  category: a.category ? { id: String(a.category._id), name: a.category.name ?? {} } : null,
  publishedAt: a.publishedAt ?? null,
  pinnedUntil: a.pinnedUntil ?? null,
  pinnedAt: a.pinnedAt ?? null,
  featuredAt: a.featuredAt ?? null,
  editorsPickAt: a.editorsPickAt ?? null,
  breakingUntil: a.breakingUntil ?? null,
});

export async function curationOverview(locale: Locale) {
  const now = new Date();
  const live = { locale, status: "published", publishedAt: { $lte: now } };
  const find = (filter: Record<string, unknown>, sort: Record<string, 1 | -1>) =>
    Article.find(filter).select(FIELDS).populate("category", "name").sort(sort).limit(100).lean<Row[]>();
  const [home, pins, featured, picks, breaking, notLive] = await Promise.all([
    homepage(locale),
    find({ ...live, pinnedUntil: { $gt: now } }, { pinnedAt: -1, updatedAt: -1, _id: -1 }),
    find({ ...live, isFeatured: true }, { featuredAt: -1, updatedAt: -1, _id: -1 }),
    find({ ...live, isEditorsPick: true }, { editorsPickAt: -1, updatedAt: -1, _id: -1 }),
    find({ ...live, breakingUntil: { $gt: now } }, { breakingUntil: 1 }),
    // Choices on stories readers cannot see: they take effect only once the story is published.
    find(
      { locale, $or: [{ status: { $ne: "published" } }, { publishedAt: { $gt: now } }], $and: [{ $or: [{ pinnedUntil: { $gt: now } }, { isFeatured: true }, { isEditorsPick: true }, { breakingUntil: { $gt: now } }] }] },
      { updatedAt: -1 },
    ),
  ]);
  return {
    homepage: {
      lead: home.lead ? { id: home.lead.id, title: home.lead.title } : null,
      top: home.top.map((a) => ({ id: a.id, title: a.title })),
      editorsPicks: home.editorsPicks.map((a) => ({ id: a.id, title: a.title })),
      breaking: home.breaking.map((a) => a.id),
    },
    pins: pins.map(view),
    featured: featured.map(view),
    picks: picks.map(view),
    breaking: breaking.map(view),
    notLive: notLive.map(view),
  };
}

const ACTIONS = ["pin", "unpin", "feature", "unfeature", "pick", "unpick", "breaking", "endBreaking"] as const;
const actionSchema = z
  .object({ action: z.enum(ACTIONS), until: z.iso.datetime({ offset: true }).optional() })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.action === "pin" || v.action === "breaking") && !v.until) ctx.addIssue({ code: "custom", path: ["until"], message: "Choose until when" });
    if (v.until && new Date(v.until).getTime() <= Date.now()) ctx.addIssue({ code: "custom", path: ["until"], message: "Must be in the future" });
  });

/** Choosing again (pin, feature, pick) also moves a story to the front of its list. */
export async function applyCuration(id: unknown, input: z.output<typeof actionSchema>) {
  const article = await Article.findById(id);
  if (!article) throw notFound("Article");
  const adding = ["pin", "feature", "pick", "breaking"].includes(input.action);
  if (adding && article.status !== "published") throw new AppError("conflict", "Only published stories can be placed on the homepage");
  const now = new Date();
  const set: Record<string, unknown> = {
    pin: { pinnedUntil: input.until ? new Date(input.until) : null, pinnedAt: now },
    unpin: { pinnedUntil: null },
    feature: { isFeatured: true, featuredAt: now },
    unfeature: { isFeatured: false },
    pick: { isEditorsPick: true, editorsPickAt: now },
    unpick: { isEditorsPick: false },
    breaking: { breakingUntil: input.until ? new Date(input.until) : null },
    endBreaking: { breakingUntil: null },
  }[input.action]!;
  return (await Article.findByIdAndUpdate(article._id, { $set: set, $inc: { version: 1 } }, { returnDocument: "after" }))!;
}

/** /admin/curation */
export function adminCurationRoutes(deps: { revalidate: Revalidator }) {
  const r = Router();
  r.use(noStore, requirePermission("homepage:manage"));
  r.get("/", async (req: Request, res: Response) => {
    const { locale } = parse(z.object({ locale: localeSchema }), req.query);
    res.json({ data: await curationOverview(locale) });
  });
  r.post("/:id", async (req: Request, res: Response) => {
    const { id } = parse(z.object({ id: objectId }), req.params);
    const input = parse(actionSchema, req.body);
    const updated = await applyCuration(id, input);
    await audit(req, { action: `homepage.${input.action}`, entityType: "article", entityId: String(id), summary: updated.title, metadata: input.until ? { until: input.until } : undefined });
    if (updated.status === "published") await deps.revalidate(revalidationTags(updated));
    res.json({ data: { id: String(id), version: updated.version } });
  });
  return r;
}
