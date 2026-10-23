import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { env } from "../../config/env.js";
import { notFound } from "../../lib/errors.js";
import { pageMeta, parse } from "../../lib/http.js";
import { normalizeReferrer, recordView } from "../analytics/analytics.service.js";
import * as categoryService from "../category/category.service.js";
import * as tagService from "../tag/tag.service.js";
import { findPublicAuthorId } from "../user/user.service.js";
import * as articles from "./article.service.js";
import {
  archiveParams,
  idParams,
  listQuery,
  localeQuery,
  popularQuery,
  searchQuery,
  sitemapQuery,
  slugParam,
  suggestQuery,
  viewBody,
} from "./article.validation.js";

/** Reader-facing article endpoints (no authentication required). */
export const articleController = {
  async homepage(req: Request, res: Response) {
    const { locale } = parse(localeQuery, req.query);
    res.json({ data: await articles.homepage(locale) });
  },

  async list(req: Request, res: Response) {
    const q = parse(listQuery, req.query);
    let category: Types.ObjectId[] | undefined;
    let tag: Types.ObjectId | undefined;
    let author: Types.ObjectId | undefined;
    if (q.category) {
      const found = await categoryService.findBySlugWithChildren(q.locale, q.category);
      if (!found) throw notFound("Category");
      category = found.ids;
    }
    if (q.tag) {
      tag = (await tagService.findIdBySlug(q.locale, q.tag)) ?? undefined;
      if (!tag) throw notFound("Tag");
    }
    if (q.author) {
      author = (await findPublicAuthorId(q.author)) ?? undefined;
      if (!author) throw notFound("Author");
    }
    const range = q.date ? articles.dayRange(q.date) : undefined;
    const { items, total } = await articles.listArticles({
      locale: q.locale,
      category,
      tag,
      author,
      format: q.format,
      from: range?.from,
      to: range?.to,
      page: q.page,
      limit: q.limit,
    });
    res.json({ data: items, meta: pageMeta(q.page, q.limit, total) });
  },

  async popular(req: Request, res: Response) {
    const q = parse(popularQuery, req.query);
    res.json({
      data: await articles.popularArticles(q.locale, q.limit),
      meta: { metric: "page_views", windowDays: 7, definition: "Article page views counted once per browser session over the last 7 UTC days" },
    });
  },

  async breaking(req: Request, res: Response) {
    const { locale } = parse(localeQuery, req.query);
    res.json({ data: await articles.breakingArticles(locale) });
  },

  /** A story, or {redirect} when the slug was changed after publication. */
  async bySlug(req: Request, res: Response) {
    const { locale } = parse(localeQuery, req.query);
    const slug = parse(slugParam, req.params.slug);
    const article = await articles.getPublishedBySlug(locale, slug);
    if (article) {
      res.json({ data: article });
      return;
    }
    const redirectTo = await articles.resolvePreviousSlug(locale, slug);
    if (!redirectTo) throw notFound("Article");
    res.json({ data: null, redirect: { slug: redirectTo } });
  },

  async related(req: Request, res: Response) {
    const { id } = parse(idParams, req.params);
    const { locale } = parse(localeQuery, req.query);
    res.json({ data: await articles.relatedArticles(locale, String(id)) });
  },

  async view(req: Request, res: Response) {
    const { id } = parse(idParams, req.params);
    const body = parse(viewBody, req.body ?? {});
    const article = await articles.findPublishedForView(id);
    if (!article) throw notFound("Article");
    await recordView(article._id, article.locale, normalizeReferrer(body.referrer, new URL(env().WEB_BASE_URL).hostname));
    res.set("Cache-Control", "no-store").status(204).end();
  },

  async search(req: Request, res: Response) {
    const q = parse(searchQuery, req.query);
    let category: Types.ObjectId | undefined;
    let author: Types.ObjectId | undefined;
    if (q.category) {
      category = (await categoryService.findIdBySlug(q.locale, q.category)) ?? undefined;
      if (!category) throw notFound("Category");
    }
    if (q.author) {
      author = (await findPublicAuthorId(q.author)) ?? undefined;
      if (!author) throw notFound("Author");
    }
    const result = await articles.searchArticles({
      locale: q.locale,
      q: q.q,
      category,
      author,
      from: q.from ? articles.dayRange(q.from).from : undefined,
      to: q.to ? articles.dayRange(q.to).to : undefined,
      page: q.page,
      limit: q.limit,
    });
    res.set("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({ data: result.items, meta: { ...pageMeta(q.page, q.limit, result.total), mode: result.mode } });
  },

  async suggest(req: Request, res: Response) {
    const q = parse(suggestQuery, req.query);
    res.set("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json({ data: await articles.suggestTitles(q.locale, q.q) });
  },

  async archive(req: Request, res: Response) {
    const p = parse(archiveParams, req.params);
    const { locale } = parse(localeQuery, req.query);
    res.json({ data: await articles.archiveDays(locale, p.year, p.month) });
  },

  async sitemap(req: Request, res: Response) {
    const q = parse(sitemapQuery, req.query);
    const { items, total } = await articles.sitemapEntries(q.locale, q.page, q.since);
    res.json({ data: items, meta: pageMeta(q.page, articles.SITEMAP_PAGE_SIZE, total) });
  },
};
