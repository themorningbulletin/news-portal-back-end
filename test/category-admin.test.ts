import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { Article, Category, SiteSettings, UserProfile } from "../src/shared/models.js";
import { staff, useTestApp } from "./helpers.js";

describe("managing sections", () => {
  const ctx = useTestApp();
  const url = "/api/v1/admin/categories";
  beforeEach(async () => {
    await seedDatabase();
  });

  it("makes the web address from the name, and never repeats one", async () => {
    const admin = await staff("admin");
    const first = await request(ctx.app).post(url).set(admin.auth).send({ name: { bn: "জলবায়ু সংবাদ", en: "Climate & Nature" } });
    expect(first.status).toBe(201);
    expect(first.body.data.slug).toEqual({ bn: "জলবায়ু-সংবাদ", en: "climate-nature" });

    const again = await request(ctx.app).post(url).set(admin.auth).send({ name: { bn: "জলবায়ু সংবাদ", en: "Climate & Nature" }, slug: { bn: "", en: "" } });
    expect(again.status).toBe(201);
    expect(again.body.data.slug).toEqual({ bn: "জলবায়ু-সংবাদ-2", en: "climate-nature-2" });

    // Editing keeps the address unless a new one is sent.
    const kept = await request(ctx.app).patch(`${url}/${first.body.data.id}`).set(admin.auth).send({ name: { bn: "জলবায়ু", en: "Climate" } });
    expect(kept.body.data.slug.en).toBe("climate-nature");
  });

  it("deletes a section, moving its stories and clearing it from the homepage and followers", async () => {
    const admin = await staff("admin");
    const health = await Category.findOne({ "slug.en": "health" });
    const national = await Category.findOne({ "slug.en": "national" });
    const stories = await Article.countDocuments({ category: health!._id });
    expect(stories).toBeGreaterThan(0);
    await SiteSettings.updateOne({ key: "site" }, { $push: { homepageSections: { kind: "section", category: health!._id, variant: "grid", width: 12 } } });
    const reader = await UserProfile.create({ firebaseUid: "r1", role: "reader", followedCategories: [health!._id, national!._id] });

    const refused = await request(ctx.app).delete(`${url}/${health!._id}`).set(admin.auth);
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.stories).toBe(stories);

    const author = await staff("author");
    expect((await request(ctx.app).delete(`${url}/${health!._id}?moveTo=${national!._id}`).set(author.auth)).status).toBe(403);

    const ok = await request(ctx.app).delete(`${url}/${health!._id}?moveTo=${national!._id}`).set(admin.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.data.moved).toBe(stories);
    expect(await Category.exists({ _id: health!._id })).toBeNull();
    expect(await Article.countDocuments({ category: health!._id })).toBe(0);
    const layout = (await SiteSettings.findOne({ key: "site" }).lean())!.homepageSections.map((b) => String(b.category));
    expect(layout).not.toContain(String(health!._id));
    expect((await UserProfile.findById(reader._id).lean())!.followedCategories.map(String)).toEqual([String(national!._id)]);
  });

  it("will not delete a section that still has subsections", async () => {
    const admin = await staff("admin");
    const sports = await Category.findOne({ "slug.en": "sports" });
    const res = await request(ctx.app).delete(`${url}/${sports!._id}?moveTo=${sports!._id}`).set(admin.auth);
    expect(res.status).toBe(422);
    expect(await Category.exists({ _id: sports!._id })).not.toBeNull();
  });
});
