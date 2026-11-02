import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { Article, ArticleDailyStat, ArticleRevision, Bookmark, Media } from "../src/shared/models.js";
import { fakeStorage, staff, useTestApp } from "./helpers.js";

const image = (name: string, provider: "cloudinary" | "static" = "cloudinary") =>
  Media.create({
    provider,
    publicId: `test/${name}`,
    url: `https://res.cloudinary.com/demo/image/upload/test/${name}.jpg`,
    width: 1200,
    height: 800,
    format: "jpg",
  });

describe("deleting a story", () => {
  const storage = fakeStorage();
  const ctx = useTestApp({ storage });
  const url = (id: unknown) => `/api/v1/admin/articles/${String(id)}`;

  beforeEach(async () => {
    storage.destroyed.length = 0;
    await seedDatabase();
  });

  it("removes the story with its history and only the images nothing else uses", async () => {
    const editor = await staff("editor");
    const [only, shared, inBody, inOldVersion, inOtherBody, sample] = await Promise.all([
      image("only"),
      image("shared"),
      image("in-body"),
      image("in-old-version"),
      image("in-other-body"),
      image("sample", "static"),
    ]);
    const [story, other] = await Article.find({ locale: "en", status: "published" }).limit(2);
    await Article.updateOne(
      { _id: story!._id },
      {
        featuredImage: only!._id,
        "seo.socialImage": shared!._id,
        body: `<p>Text</p><img src="${inBody!.url}" alt="a"><img src="${inOtherBody!.url}" alt="b"><img src="${sample!.url}" alt="c">`,
      },
    );
    await Article.updateOne({ _id: other!._id }, { featuredImage: shared!._id, body: `<p>Text</p><img src="${inOtherBody!.url}" alt="b">` });
    await ArticleRevision.create({
      article: story!._id,
      version: 1,
      reason: "manual",
      status: "draft",
      snapshot: { featuredImage: String(inOldVersion!._id), body: "<p>Old</p>" },
      createdBy: editor.profile._id,
    });
    await ArticleDailyStat.create({ article: story!._id, locale: "en", day: "2026-10-20", views: 5, expiresAt: new Date(Date.now() + 86_400_000) });

    const res = await request(ctx.app).delete(url(story!._id)).set(editor.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.images).toEqual({ deleted: 3, kept: 3 });
    expect(storage.destroyed.sort()).toEqual(["test/in-body", "test/in-old-version", "test/only"]);

    expect(await Article.findById(story!._id)).toBeNull();
    expect(await ArticleRevision.countDocuments({ article: story!._id })).toBe(0);
    expect(await ArticleDailyStat.countDocuments({ article: story!._id })).toBe(0);
    expect(await Media.findById(only!._id)).toBeNull();
    expect(await Media.findById(shared!._id)).not.toBeNull();
    expect(await Media.findById(inOtherBody!._id)).not.toBeNull();
    expect(await Media.findById(sample!._id)).not.toBeNull();
    expect(ctx.revalidated.flat()).toContain("articles");
    expect((await request(ctx.app).get(`/api/v1/articles/by-slug/${encodeURIComponent(story!.slug)}?locale=en`)).status).toBe(404);
  });

  it("keeps the library record when storage refuses, and bookmarks while a translation remains", async () => {
    const editor = await staff("editor");
    const reader = await staff("reader");
    const stuck = await image("stuck");
    const story = await Article.findOne({ locale: "en", status: "published", translationGroup: { $in: await Article.distinct("translationGroup", { locale: "bn" }) } });
    await Article.updateOne({ _id: story!._id }, { featuredImage: stuck!._id });
    await Bookmark.create({ user: reader.profile._id, translationGroup: story!.translationGroup });
    const realDestroy = storage.destroy;
    storage.destroy = async () => {
      throw new Error("storage down");
    };
    try {
      const res = await request(ctx.app).delete(url(story!._id)).set(editor.auth);
      expect(res.status).toBe(200);
      expect(res.body.data.images).toEqual({ deleted: 0, kept: 1 });
    } finally {
      storage.destroy = realDestroy;
    }
    expect(await Media.findById(stuck!._id)).not.toBeNull();
    expect(await Bookmark.countDocuments({ translationGroup: story!.translationGroup })).toBe(1);

    const sibling = await Article.findOne({ translationGroup: story!.translationGroup });
    await request(ctx.app).delete(url(sibling!._id)).set(editor.auth).expect(200);
    expect(await Bookmark.countDocuments({ translationGroup: story!.translationGroup })).toBe(0);
  });

  it("lets authors delete only their own drafts", async () => {
    const author = await staff("author");
    const someone = await Article.findOne({ status: "published" });
    expect((await request(ctx.app).delete(url(someone!._id)).set(author.auth)).status).toBe(404);
    expect((await request(ctx.app).delete(url(someone!._id))).status).toBe(403);

    await Article.updateOne({ _id: someone!._id }, { authors: [author.profile._id] });
    expect((await request(ctx.app).delete(url(someone!._id)).set(author.auth)).status).toBe(403);
    await Article.updateOne({ _id: someone!._id }, { status: "draft" });
    const view = await request(ctx.app).get(url(someone!._id)).set(author.auth);
    expect(view.body.data.permissions.canDelete).toBe(true);
    expect((await request(ctx.app).delete(url(someone!._id)).set(author.auth)).status).toBe(200);
  });
});
