import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { Article, ArticleDailyStat } from "../src/shared/models.js";
import { seedDatabase } from "../src/seed/run.js";
import { useTestApp } from "./helpers.js";

describe("public reading API", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("builds a homepage for each locale without login", async () => {
    for (const locale of ["bn", "en"]) {
      const res = await request(ctx.app).get(`/api/v1/homepage?locale=${locale}`);
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toContain("public");
      const { lead, top, latest, sections, breaking } = res.body.data;
      expect(lead.locale).toBe(locale);
      expect(top.length).toBeGreaterThan(0);
      expect(latest.length).toBeGreaterThan(0);
      expect(sections.length).toBeGreaterThan(0);
      // Nothing is marked breaking in the demo content, so no ticker.
      expect(breaking).toEqual([]);
      const ids = [lead, ...top].map((a: { id: string }) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("requires a valid locale", async () => {
    const res = await request(ctx.app).get("/api/v1/homepage?locale=fr");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("serves a Bangla story by its Unicode slug with its translation link", async () => {
    const bn = await Article.findOne({ locale: "bn", format: "explainer" }).lean();
    const res = await request(ctx.app).get(`/api/v1/articles/by-slug/${encodeURIComponent(bn!.slug)}?locale=bn`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(bn!.title);
    expect(res.body.data.body).toContain("<p>");
    expect(res.body.data.translations).toHaveLength(1);
    expect(res.body.data.translations[0].locale).toBe("en");
  });

  it("never exposes drafts, scheduled or future stories", async () => {
    const story = await Article.findOne({ locale: "en" });
    story!.status = "draft";
    await story!.save();
    const res = await request(ctx.app).get(`/api/v1/articles/by-slug/${story!.slug}?locale=en`);
    expect(res.status).toBe(404);

    const future = await Article.findOne({ locale: "en", _id: { $ne: story!._id } });
    future!.publishedAt = new Date(Date.now() + 3_600_000);
    await future!.save();
    expect((await request(ctx.app).get(`/api/v1/articles/by-slug/${future!.slug}?locale=en`)).status).toBe(404);

    const list = await request(ctx.app).get("/api/v1/articles?locale=en&limit=50");
    const slugs = list.body.data.map((a: { slug: string }) => a.slug);
    expect(slugs).not.toContain(story!.slug);
    expect(slugs).not.toContain(future!.slug);

    const sitemap = await request(ctx.app).get("/api/v1/sitemap/articles?locale=en");
    expect(sitemap.body.data.map((a: { slug: string }) => a.slug)).not.toContain(story!.slug);
  });

  it("tells clients to redirect an old slug to the current one", async () => {
    const story = await Article.findOne({ locale: "en" });
    story!.previousSlugs = ["old-headline"];
    await story!.save();
    const res = await request(ctx.app).get("/api/v1/articles/by-slug/old-headline?locale=en");
    expect(res.status).toBe(200);
    expect(res.body.redirect).toEqual({ slug: story!.slug });
  });

  it("paginates lists and filters by section including subsections", async () => {
    const page1 = await request(ctx.app).get("/api/v1/articles?locale=en&limit=5&page=1");
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.meta).toMatchObject({ page: 1, limit: 5 });
    const page2 = await request(ctx.app).get("/api/v1/articles?locale=en&limit=5&page=2");
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);

    const sports = await request(ctx.app).get("/api/v1/articles?locale=en&category=sports");
    expect(sports.status).toBe(200);
    expect(sports.body.data.some((a: { category: { slug: string } }) => a.category.slug === "cricket")).toBe(true);

    expect((await request(ctx.app).get("/api/v1/articles?locale=en&category=nope")).status).toBe(404);
    expect((await request(ctx.app).get("/api/v1/articles?locale=en&limit=500")).status).toBe(422);
  });

  it("searches with the text index and falls back for inflected Bangla words", async () => {
    const en = await request(ctx.app).get("/api/v1/search?locale=en&q=inflation");
    expect(en.status).toBe(200);
    expect(en.body.data[0].slug).toBe("what-inflation-is-how-it-is-measured");
    expect(en.body.meta.mode).toBe("text");

    // "বাজেট" only appears inflected ("বাজেটে"), which the token index cannot match; the fallback can.
    const bn = await request(ctx.app).get(`/api/v1/search?locale=bn&q=${encodeURIComponent("বাজেট")}`);
    expect(bn.status).toBe(200);
    const titles = bn.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain("জাতিসংঘ সাধারণ পরিষদ কী করে");
    expect(titles).toContain("মূল্যস্ফীতি কী, আর কীভাবে তা মাপা হয়");
    expect(bn.body.meta.mode).toBe("combined");

    const none = await request(ctx.app).get("/api/v1/search?locale=en&q=zzzzqqq");
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.total).toBe(0);

    // Regex metacharacters are treated literally.
    expect((await request(ctx.app).get(`/api/v1/search?locale=en&q=${encodeURIComponent(".*(")}`)).status).toBe(200);
  });

  it("counts anonymous views and ranks most-read stories by them", async () => {
    const [a, b] = await Article.find({ locale: "en" }).limit(2);
    for (let i = 0; i < 3; i++) await request(ctx.app).post(`/api/v1/articles/${b!._id}/view`).send({ referrer: "https://www.example.org/x" }).expect(204);
    await request(ctx.app).post(`/api/v1/articles/${a!._id}/view`).send({}).expect(204);
    const res = await request(ctx.app).get("/api/v1/articles/popular?locale=en");
    expect(res.body.data[0].id).toBe(String(b!._id));
    expect(res.body.data[0].views).toBe(3);
    expect(res.body.meta.windowDays).toBe(7);
    const stat = await ArticleDailyStat.findOne({ article: b!._id }).lean();
    // Only aggregate counts are stored.
    expect(Object.keys(stat!).sort()).toEqual(["__v", "_id", "article", "day", "expiresAt", "locale", "views"].sort());
  });

  it("shows no fabricated popularity when there are no views", async () => {
    const res = await request(ctx.app).get("/api/v1/articles/popular?locale=bn");
    expect(res.body.data).toEqual([]);
  });

  it("returns sections, topics, authors and archive days", async () => {
    const cats = await request(ctx.app).get("/api/v1/categories?locale=bn");
    expect(cats.body.data.length).toBeGreaterThan(5);
    const nat = cats.body.data.find((c: { alternates: { en: string } }) => c.alternates.en === "national");
    const one = await request(ctx.app).get(`/api/v1/categories/${encodeURIComponent(nat.slug)}?locale=bn`);
    expect(one.status).toBe(200);
    expect(one.body.data.name).toBe("জাতীয়");

    const tags = await request(ctx.app).get("/api/v1/tags?locale=en");
    expect(tags.body.data[0].count).toBeGreaterThan(0);

    const author = await request(ctx.app).get("/api/v1/authors/explainer-desk?locale=en");
    expect(author.body.data.name).toBe("Explainer Desk");

    const now = new Date();
    const arc = await request(ctx.app).get(`/api/v1/archive/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}?locale=en`);
    expect(arc.status).toBe(200);
  });

  it("hides editorial pages until they are published", async () => {
    expect((await request(ctx.app).get("/api/v1/pages/about?locale=en")).status).toBe(404);
    expect((await request(ctx.app).get("/api/v1/pages/unknown?locale=en")).status).toBe(422);
  });

  it("lists no ad placements while none are configured", async () => {
    const res = await request(ctx.app).get("/api/v1/ads/placements");
    expect(res.body.data).toEqual([]);
  });
});
