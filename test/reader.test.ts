import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { Article, Bookmark, Category, NewsletterSubscriber, UserProfile } from "../src/shared/models.js";
import { seedDatabase } from "../src/seed/run.js";
import { cookieSession, staff, useTestApp } from "./helpers.js";

describe("reader account features", () => {
  const ctx = useTestApp();
  beforeEach(async () => {
    await seedDatabase();
  });

  it("saves, lists and removes bookmarks in the reader's language", async () => {
    const reader = await staff("reader");
    const story = await Article.findOne({ locale: "en" }).lean();
    const group = String(story!.translationGroup);
    expect((await request(ctx.app).put(`/api/v1/me/bookmarks/${group}`).set(reader.auth)).status).toBe(204);
    // Idempotent.
    expect((await request(ctx.app).put(`/api/v1/me/bookmarks/${group}`).set(reader.auth)).status).toBe(204);
    const bn = await request(ctx.app).get("/api/v1/me/bookmarks?locale=bn").set(reader.auth);
    expect(bn.body.data).toHaveLength(1);
    expect(bn.body.data[0].locale).toBe("bn");
    expect(bn.headers["cache-control"]).toContain("no-store");
    expect((await request(ctx.app).delete(`/api/v1/me/bookmarks/${group}`).set(reader.auth)).status).toBe(204);
    expect((await request(ctx.app).get("/api/v1/me/bookmarks/ids").set(reader.auth)).body.data).toEqual([]);
  });

  it("builds a feed from followed sections", async () => {
    const reader = await staff("reader");
    const health = await Category.findOne({ "slug.en": "health" }).lean();
    const f = await request(ctx.app).put("/api/v1/me/follows").set(reader.auth).send({ categories: [String(health!._id)] });
    expect(f.status).toBe(200);
    const feed = await request(ctx.app).get("/api/v1/me/feed?locale=en").set(reader.auth);
    expect(feed.body.data.length).toBeGreaterThan(0);
    expect(feed.body.data.every((a: { category: { slug: string } }) => a.category.slug === "health")).toBe(true);
  });

  it("exports personal data and deletes the account", async () => {
    const { agent, csrf } = await cookieSession(ctx.app, "reader-delete");
    const story = await Article.findOne({ locale: "en" }).lean();
    await agent.put(`/api/v1/me/bookmarks/${story!.translationGroup}`).set("X-CSRF-Token", csrf).expect(204);
    const exp = await agent.get("/api/v1/me/export");
    expect(exp.body.bookmarks).toHaveLength(1);
    expect(exp.headers["content-disposition"]).toContain("attachment");

    expect((await agent.delete("/api/v1/me").set("X-CSRF-Token", csrf).send({})).status).toBe(422);
    const del = await agent.delete("/api/v1/me").set("X-CSRF-Token", csrf).send({ confirm: "DELETE" });
    expect(del.status).toBe(204);
    expect(await UserProfile.exists({ firebaseUid: "reader-delete" })).toBeNull();
    expect(await Bookmark.countDocuments()).toBe(0);
    expect(ctx.identity.deleted).toContain("reader-delete");
  });

  it("does not let staff delete their own accounts", async () => {
    const editor = await staff("editor");
    const res = await request(ctx.app).delete("/api/v1/me").set(editor.auth).send({ confirm: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("updates reading preferences", async () => {
    const reader = await staff("reader");
    const res = await request(ctx.app).patch("/api/v1/me/preferences").set(reader.auth).send({ theme: "dark", textSize: "lg" });
    expect(res.body.data.preferences).toMatchObject({ theme: "dark", textSize: "lg" });
    expect((await request(ctx.app).patch("/api/v1/me/preferences").set(reader.auth).send({ theme: "neon" })).status).toBe(422);
  });
});

describe("newsletter double opt-in", () => {
  const ctx = useTestApp({ rateLimits: { newsletter: 50 } });

  const tokenFrom = (text: string, kind: "confirm" | "unsubscribe") => new RegExp(`/newsletter/${kind}\\?token=([A-Za-z0-9_-]+)`).exec(text)![1]!;

  it("subscribes only after confirmation and allows unsubscribing", async () => {
    const sub = await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "Reader@Example.org", locale: "bn" });
    expect(sub.status).toBe(202);
    expect((await NewsletterSubscriber.findOne().lean())!.status).toBe("pending");
    const mail = ctx.mailer.sent[0]!;
    expect(mail.to).toBe("reader@example.org");
    expect(mail.subject).toContain("নিশ্চিত");
    // Tokens are stored only as hashes.
    const confirm = tokenFrom(mail.text, "confirm");
    expect(await NewsletterSubscriber.exists({ confirmTokenHash: confirm })).toBeNull();

    expect((await request(ctx.app).post("/api/v1/newsletter/confirm").send({ token: confirm })).status).toBe(200);
    expect((await NewsletterSubscriber.findOne().lean())!.status).toBe("active");
    expect((await request(ctx.app).post("/api/v1/newsletter/confirm").send({ token: confirm })).status).toBe(404);

    const un = await request(ctx.app).post("/api/v1/newsletter/unsubscribe").send({ token: tokenFrom(mail.text, "unsubscribe") });
    expect(un.status).toBe(200);
    expect((await NewsletterSubscriber.findOne().lean())!.status).toBe("unsubscribed");
  });

  it("answers identically for known addresses and drops honeypot submissions", async () => {
    await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "a@example.org", locale: "en" });
    const again = await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "a@example.org", locale: "en" });
    expect(again.status).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(1);
    const bot = await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "bot@example.org", locale: "en", website: "http://spam" });
    expect(bot.status).toBe(202);
    expect(await NewsletterSubscriber.exists({ email: "bot@example.org" })).toBeNull();
  });
});

describe("newsletter abuse protection", () => {
  const ctx = useTestApp();
  it("rate-limits subscription attempts", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: `n${i}@example.org`, locale: "en" })).status).toBe(202);
    }
    expect((await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "n9@example.org", locale: "en" })).status).toBe(429);
  });
});
