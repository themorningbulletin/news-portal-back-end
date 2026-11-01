import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { parseEnv, resetEnvCache } from "../src/config/env.js";
import { normalizePrivateKey } from "../src/lib/identity.js";
import { analyzeSeo, type SeoInput } from "../src/modules/seo/seo.analyzer.js";
import { seedDatabase } from "../src/seed/run.js";
import { Article, ArticleDailyStat } from "../src/shared/models.js";
import { staff, useTestApp } from "./helpers.js";

const base: SeoInput = {
  locale: "en",
  title: "How the monsoon forecast is made in Bangladesh",
  slug: "how-the-monsoon-forecast-is-made",
  summary: "A short summary.",
  body: `<p>The monsoon forecast combines satellite data and models.</p><h2>Data</h2><p>${"Forecasters study the monsoon carefully. ".repeat(60)}</p><p><a href="/en/news/x">related</a> <a href="https://example.org">source</a></p>`,
  seoTitle: "",
  seoDescription: "How meteorologists build the seasonal monsoon forecast, what the numbers mean and how reliable it is for farmers.",
  canonicalUrl: "",
  focusKeyword: "monsoon",
  hasImage: true,
  imageAlt: "Clouds over a paddy field",
  tagCount: 2,
  hasCategory: true,
  hasTranslation: true,
  ownUrl: "http://localhost:3000/en/news/how-the-monsoon-forecast-is-made",
  siteHost: "localhost:3000",
};

describe("SEO analyzer", () => {
  it("scores a well-optimised story highly", () => {
    const a = analyzeSeo(base, { duplicateTitle: false, duplicateDescription: false });
    expect(a.grade).toBe("good");
    expect(a.checks.filter((c) => c.status === "bad")).toEqual([]);
    expect(a.checks.find((c) => c.id === "internal_links")?.data).toEqual({ count: 1 });
  });

  it("flags missing keyword placement, thin content, missing alt and duplicates", () => {
    const a = analyzeSeo(
      { ...base, title: "Weather", seoDescription: "", body: "<p>Short.</p>", imageAlt: "", focusKeyword: "monsoon" },
      { duplicateTitle: true },
    );
    const status = Object.fromEntries(a.checks.map((c) => [c.id, c.status]));
    expect(status).toMatchObject({
      keyword_in_title: "bad",
      content_length: "bad",
      image_alt: "bad",
      duplicate_title: "bad",
      description: "warn",
      title_length: "bad",
    });
    expect(a.grade).toBe("poor");
    expect(a.snippet.usesSummary).toBe(true);
  });

  it("matches inflected Bangla keywords", () => {
    const a = analyzeSeo({ ...base, locale: "bn", title: "বর্ষার পূর্বাভাস কীভাবে তৈরি হয় তা নিয়ে বিস্তারিত ব্যাখ্যা", focusKeyword: "বর্ষা", body: "<p>বর্ষার পূর্বাভাস নিয়ে কথা।</p>" });
    expect(a.checks.find((c) => c.id === "keyword_in_title")?.status).toBe("good");
    expect(a.checks.find((c) => c.id === "keyword_in_intro")?.status).toBe("good");
  });
});

describe("SEO dashboard and newsroom tools", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("audits every published story for editors only", async () => {
    const editor = await staff("editor");
    const author = await staff("author");
    const res = await request(ctx.app).get("/api/v1/admin/seo/overview").set(editor.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.analysed).toBe(28);
    expect(res.body.data.trustPages.find((p: { key: string }) => p.key === "about")).toEqual({ key: "about", bn: false, en: false });
    expect((await request(ctx.app).get("/api/v1/admin/seo/overview").set(author.auth)).status).toBe(403);
    expect((await request(ctx.app).get("/api/v1/admin/seo/overview")).status).toBe(401);

    const list = await request(ctx.app).get("/api/v1/admin/seo/articles?locale=en&limit=5").set(editor.auth);
    expect(list.body.data).toHaveLength(5);
    const scores = list.body.data.map((r: { score: number }) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it("analyses an unsaved draft for any writer", async () => {
    const author = await staff("author");
    const res = await request(ctx.app)
      .post("/api/v1/admin/seo/analyze")
      .set(author.auth)
      .send({ locale: "en", title: "What a 60% chance of rain actually means", slug: "draft", body: "<p>x</p>", seo: { focusKeyword: "rain" } });
    expect(res.status).toBe(200);
    // Same headline as a published story.
    expect(res.body.data.checks.find((c: { id: string }) => c.id === "duplicate_title").status).toBe("bad");
  });

  it("duplicates a story as an unlinked draft", async () => {
    const editor = await staff("editor");
    const src = await Article.findOne({ locale: "bn" }).lean();
    const res = await request(ctx.app).post(`/api/v1/admin/articles/${src!._id}/duplicate`).set(editor.auth);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.title).toContain("(কপি)");
    expect(res.body.data.translationGroup).not.toBe(String(src!.translationGroup));
    expect(res.body.data.slug).not.toBe(src!.slug);
  });

  it("lists the editorial calendar and shows view counts", async () => {
    const editor = await staff("editor");
    const now = new Date();
    const a = await Article.findOne({ locale: "en" }).lean();
    await ArticleDailyStat.create({ article: a!._id, locale: "en", day: now.toISOString().slice(0, 10), views: 7, expiresAt: new Date(Date.now() + 86_400_000) });
    const dhaka = new Date(now.getTime() + 6 * 3_600_000);
    const cal = await request(ctx.app)
      .get(`/api/v1/admin/articles/calendar?year=${dhaka.getUTCFullYear()}&month=${dhaka.getUTCMonth() + 1}`)
      .set(editor.auth);
    expect(cal.status).toBe(200);
    expect(cal.body.data.length).toBeGreaterThan(0);
    const view = await request(ctx.app).get(`/api/v1/admin/articles/${a!._id}`).set(editor.auth);
    expect(view.body.data.stats).toEqual({ views7: 7, views30: 7 });
  });

  it("lets editors end a breaking banner immediately", async () => {
    const editor = await staff("editor");
    const author = await staff("author");
    const a = await Article.findOneAndUpdate({ locale: "en" }, { breakingUntil: new Date(Date.now() + 3_600_000) }, { returnDocument: "after" });
    const dash = await request(ctx.app).get("/api/v1/admin/dashboard").set(editor.auth);
    expect(dash.body.data.homepageControls.map((x: { id: string }) => x.id)).toContain(String(a!._id));
    expect((await request(ctx.app).post(`/api/v1/admin/articles/${a!._id}/end-breaking`).set(author.auth)).status).toBe(403);
    expect((await request(ctx.app).post(`/api/v1/admin/articles/${a!._id}/end-breaking`).set(editor.auth)).status).toBe(204);
    expect((await Article.findById(a!._id).lean())!.breakingUntil).toBeNull();
    expect(ctx.revalidated.flat()).toContain("articles");
  });
});

describe("Serverless scheduler endpoint", () => {
  const ctx = useTestApp();
  const url = "/api/v1/internal/cron/scheduler";

  it("rejects callers without the cron secret and publishes due stories with it", async () => {
    process.env.CRON_SECRET = "c".repeat(32);
    resetEnvCache();
    try {
      await seedDatabase();
      const story = await Article.findOneAndUpdate({ status: "published" }, { status: "scheduled", scheduledFor: new Date(Date.now() - 60_000) });
      expect((await request(ctx.app).get(url)).status).toBe(401);
      expect((await request(ctx.app).get(url).set("authorization", `Bearer ${"x".repeat(32)}`)).status).toBe(401);
      const ok = await request(ctx.app).get(url).set("authorization", `Bearer ${"c".repeat(32)}`);
      expect(ok.status).toBe(200);
      expect(ok.body.data.published).toBe(1);
      expect((await Article.findById(story!._id))!.status).toBe("published");
    } finally {
      delete process.env.CRON_SECRET;
      resetEnvCache();
    }
  });
});

describe("Environment on Vercel", () => {
  it("always applies the production rules, even if NODE_ENV says development", () => {
    expect(() => parseEnv({ VERCEL: "1", NODE_ENV: "development" })).toThrow(/MONGODB_URI: is required in production/);
    expect(parseEnv({ NODE_ENV: "development" }).NODE_ENV).toBe("development");
  });
});

describe("Firebase private key from a hosting dashboard", () => {
  const nl = String.fromCharCode(10);
  const escaped = ["-----BEGIN PRIVATE KEY-----", "abc", "-----END PRIVATE KEY-----", ""].join(String.fromCharCode(92) + "n");
  const real = ["-----BEGIN PRIVATE KEY-----", "abc", "-----END PRIVATE KEY-----", ""].join(nl);

  it("accepts quoted, escaped and plain multi-line values", () => {
    expect(normalizePrivateKey(`"${escaped}"`)).toBe(real);
    expect(normalizePrivateKey(`'${escaped}'`)).toBe(real);
    expect(normalizePrivateKey(escaped)).toBe(real);
    expect(normalizePrivateKey(`  ${real}  `).trim()).toBe(real.trim());
  });
});
