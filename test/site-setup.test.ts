import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { applyHomepageLayout, applyPages, applySections, SECTIONS } from "../src/seed/site-setup.js";
import { Article, Category, Page } from "../src/shared/models.js";
import { sanitizeArticleHtml } from "../src/lib/sanitize.js";
import { staff, useTestApp } from "./helpers.js";

describe("site setup", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("builds the publisher's sections, renaming instead of duplicating, and can run twice", async () => {
    const national = await Category.findOne({ "slug.en": "national" }).lean();
    const { ids } = await applySections();
    await applySections();

    const total = SECTIONS.reduce((n, s) => n + 1 + (s.children?.length ?? 0), 0);
    // Every listed section exists once; demo sections that are not listed are left alone.
    expect(await Category.countDocuments({ _id: { $in: [...ids.values()] } })).toBe(total);
    const bangladesh = await Category.findOne({ "slug.en": "bangladesh" }).lean();
    expect(String(bangladesh!._id)).toBe(String(national!._id));
    const news = await Category.findOne({ "slug.en": "news" }).lean();
    expect(String(bangladesh!.parent)).toBe(String(news!._id));
    const politics = await Category.findOne({ "slug.en": "politics" }).lean();
    expect(String(politics!.parent)).toBe(String(news!._id));
    expect((await Category.findOne({ "slug.en": "career-skill" }).lean())!.name.bn).toBe("ক্যারিয়ার ও দক্ষতা");

    // The public list carries the parent, so the menu can show subsections under it.
    const res = await request(ctx.app).get("/api/v1/categories?locale=bn");
    const cricket = res.body.data.find((c: { alternates: { en: string } }) => c.alternates.en === "cricket");
    const sports = res.body.data.find((c: { alternates: { en: string } }) => c.alternates.en === "sports");
    expect(cricket.parentId).toBe(sports.id);
  });

  it("merges a duplicate section that already holds one of the web addresses (World + Worlds)", async () => {
    // As in a real database: "Worlds" was added by hand with the Bangla address বিশ্ব.
    const worlds = await Category.create({ name: { bn: "বিশ্ব", en: "Worlds" }, slug: { bn: "বিশ্ব", en: "worlds" }, order: 20 });
    const world = await Category.findOne({ "slug.en": "world" }).lean();
    const story = await Article.findOne({ locale: "en", status: "published" });
    await Article.updateOne({ _id: story!._id }, { $set: { category: worlds._id } });

    const { ids, report } = await applySections({ deactivateOthers: true });
    expect(report.merged).toEqual(["Worlds"]);
    expect(String(ids.get("world"))).toBe(String(world!._id));
    expect((await Category.findById(world!._id).lean())!.slug).toEqual({ bn: "বিশ্ব", en: "world" });
    const old = (await Category.findById(worlds._id).lean())!;
    expect(old).toMatchObject({ isActive: false, slug: { en: "worlds-old" } });
    expect(String((await Article.findById(story!._id).lean())!.category)).toBe(String(world!._id));
    // Running it again changes nothing more.
    expect((await applySections()).report.merged).toEqual([]);
  });

  it("applies the homepage layout with ad blocks, and shows blocks that have stories", async () => {
    const { ids } = await applySections();
    // The demo content already has a layout: it is only replaced on request.
    expect((await applyHomepageLayout(ids)).applied).toBe(false);
    expect((await applyHomepageLayout(ids, { force: true })).applied).toBe(true);
    expect((await applyHomepageLayout(ids)).applied).toBe(false);

    const home = (await request(ctx.app).get("/api/v1/homepage?locale=en")).body.data;
    expect(home.top).toHaveLength(3);
    const kinds = home.sections.map((s: { kind: string }) => s.kind);
    expect(kinds.filter((k: string) => k === "ad").length).toBe(5);
    const sports = home.sections.find((s: { category?: { alternates: { en: string } } }) => s.category?.alternates.en === "sports");
    expect(sports).toMatchObject({ kind: "section", variant: "feature", width: 9 });

    // Editors see how many stories each block has, per language.
    const admin = await staff("admin");
    const settings = (await request(ctx.app).get("/api/v1/admin/settings/homepage").set(admin.auth)).body.data;
    expect(settings.sections.length).toBeGreaterThan(12);
    const sportsId = String(ids.get("sports"));
    expect(settings.published[sportsId].en).toBeGreaterThan(0);
    expect(settings.published[String(ids.get("religion"))]).toEqual({ bn: 0, en: 0 });
  });

  it("saves more than twelve blocks, ad blocks and widths, and rejects a section block without a section", async () => {
    const { ids } = await applySections();
    const admin = await staff("admin");
    const sections = [...ids.values()].slice(0, 20).map((id) => ({ kind: "section", category: String(id), variant: "list", width: 3, count: 2 }));
    const ok = await request(ctx.app)
      .put("/api/v1/admin/settings/homepage")
      .set(admin.auth)
      .send({ sections: [...sections, { kind: "ad", width: 12 }] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.sections).toHaveLength(21);
    expect(ok.body.data.sections[20]).toMatchObject({ kind: "ad", category: null, width: 12 });

    const missing = await request(ctx.app).put("/api/v1/admin/settings/homepage").set(admin.auth).send({ sections: [{ kind: "section", width: 6 }] });
    expect(missing.status).toBe(422);
    const badWidth = await request(ctx.app)
      .put("/api/v1/admin/settings/homepage")
      .set(admin.auth)
      .send({ sections: [{ kind: "section", category: String(ids.get("sports")), width: 5 }] });
    expect(badWidth.status).toBe(422);
  });

  it("adds the information pages without overwriting, holding contact pages back until there are details", async () => {
    await Page.create({ key: "about", locale: "en", title: "Our own about page", body: "<p>Ours</p>", status: "published" });
    const first = await applyPages({});
    expect(first.kept).toEqual(["about/en"]);
    expect(first.drafts.sort()).toEqual(["advertise/bn", "advertise/en", "contact/bn", "contact/en"]);
    expect((await Page.findOne({ key: "about", locale: "en" }).lean())!.title).toBe("Our own about page");

    await Page.deleteMany({ key: { $in: ["contact", "advertise"] } });
    const second = await applyPages({ email: "desk@example.test" });
    expect(second.published.sort()).toEqual(["advertise/bn", "advertise/en", "contact/bn", "contact/en"]);
    const contact = await request(ctx.app).get("/api/v1/pages/contact?locale=bn");
    expect(contact.status).toBe(200);
    expect(contact.body.data.body).toContain("mailto:desk@example.test");
    const list = (await request(ctx.app).get("/api/v1/pages?locale=en")).body.data.map((p: { key: string }) => p.key);
    expect(list).toEqual(expect.arrayContaining(["about", "privacy", "terms", "advertise", "contact"]));
  });
});

describe("social links and editor formatting", () => {
  const ctx = useTestApp();

  it("saves https social links for the footer and refuses anything else", async () => {
    const admin = await staff("admin");
    const author = await staff("author");
    const url = "/api/v1/admin/settings/social";
    expect((await request(ctx.app).put(url).set(author.auth).send({ facebook: "https://facebook.com/x" })).status).toBe(403);
    expect((await request(ctx.app).put(url).set(admin.auth).send({ facebook: "http://facebook.com/x" })).status).toBe(422);
    expect((await request(ctx.app).put(url).set(admin.auth).send({ facebook: "javascript:alert(1)" })).status).toBe(422);
    const ok = await request(ctx.app).put(url).set(admin.auth).send({ facebook: "https://facebook.com/morningbulletin", youtube: "https://youtube.com/@mb", x: "" });
    expect(ok.status).toBe(200);
    const config = await request(ctx.app).get("/api/v1/config");
    expect(config.body.data.social).toEqual({ facebook: "https://facebook.com/morningbulletin", youtube: "https://youtube.com/@mb" });
  });

  it("keeps paragraph alignment from the editor but no other styles", () => {
    const html = sanitizeArticleHtml(
      '<p style="text-align: center">a</p><h2 style="text-align:right; color:red">b</h2><p style="text-align: expression(x)">c</p><p><u>d</u> <s>e</s></p><h4>f</h4><hr>',
    );
    expect(html).toContain('<p style="text-align:center">a</p>');
    expect(html).toContain('<h2 style="text-align:right">b</h2>');
    expect(html).not.toContain("color");
    expect(html).not.toContain("expression");
    expect(html).toContain("<u>d</u> <s>e</s>");
    expect(html).toContain("<h4>f</h4>");
    expect(html).toContain("<hr />");
  });

  it("publishes a Bangla story written in one go", async () => {
    await seedDatabase();
    const editor = await staff("editor");
    const cat = await Category.findOne({ "slug.en": "world" });
    const created = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set(editor.auth)
      .send({
        locale: "bn",
        title: "মিরপুরে বাস ও লেগুনার সংঘর্ষে চারজন নিহত",
        summary: "রাজধানীর মিরপুর বেড়িবাঁধ এলাকায় বাস ও লেগুনার মুখোমুখি সংঘর্ষে চারজন নিহত হয়েছেন।",
        body: '<p style="text-align: justify">ফায়ার সার্ভিসের একটি দল দ্রুত ঘটনাস্থলে পৌঁছে উদ্ধারকাজ শুরু করে। নিহতদের মধ্যে দুজন পুরুষ ও দুজন নারী।</p>',
        category: String(cat!._id),
      });
    expect(created.status).toBe(201);
    const pub = await request(ctx.app)
      .post(`/api/v1/admin/articles/${created.body.data.id}/transition`)
      .set(editor.auth)
      .send({ action: "publish", version: created.body.data.version });
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe("published");
    expect((await Article.findById(created.body.data.id).lean())!.body).toContain('style="text-align:justify"');
  });
});
