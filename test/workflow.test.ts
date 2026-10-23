import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { Article, ArticleRevision, AuditLog, Category } from "../src/shared/models.js";
import { schedulerTick } from "../src/modules/article/article.scheduler.js";
import { staff, useTestApp } from "./helpers.js";

const BODY = "<p>" + "This is a complete paragraph of reporting with enough words to pass the checklist. ".repeat(3) + "</p>";

describe("editorial workflow", () => {
  const ctx = useTestApp();
  let categoryId: string;
  beforeEach(async () => {
    const c = await Category.create({ name: { bn: "জাতীয়", en: "National" }, slug: { bn: "জাতীয়", en: "national" } });
    categoryId = String(c._id);
  });

  async function draft(auth: Record<string, string>, extra: Record<string, unknown> = {}) {
    const res = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set(auth)
      .send({ locale: "en", title: "Council approves new bridge plan", summary: "A summary that is long enough for the checklist.", body: BODY, category: categoryId, ...extra });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; version: number; slug: string; status: string };
  }

  it("lets authors draft and submit, but not publish without permission", async () => {
    const author = await staff("author");
    const a = await draft(author.auth);
    expect(a.status).toBe("draft");
    const pub = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(author.auth).send({ action: "publish", version: a.version });
    expect(pub.status).toBe(403);
    const sub = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(author.auth).send({ action: "submit", version: a.version });
    expect(sub.status).toBe(200);
    expect(sub.body.data.status).toBe("in_review");
    // Once in review, the author can no longer edit.
    const edit = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(author.auth).send({ version: sub.body.data.version, title: "Changed" });
    expect(edit.status).toBe(403);
  });

  it("lets an editor publish, records audit and revision, and revalidates caches", async () => {
    const author = await staff("author");
    const editor = await staff("editor");
    const a = await draft(author.auth);
    const res = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(editor.auth).send({ action: "publish", version: a.version });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
    expect(ctx.revalidated.flat()).toEqual(expect.arrayContaining(["articles", `article:en:${a.slug}`]));
    expect(await AuditLog.exists({ action: "article.publish", entityId: a.id })).not.toBeNull();
    expect(await ArticleRevision.countDocuments({ article: a.id })).toBeGreaterThanOrEqual(2);
    const pub = await request(ctx.app).get(`/api/v1/articles/by-slug/${a.slug}?locale=en`);
    expect(pub.status).toBe(200);
  });

  it("allows an author with explicit permission to publish their own story only", async () => {
    const author = await staff("author", undefined, { canPublish: true });
    const other = await staff("author");
    const own = await draft(author.auth);
    const res = await request(ctx.app).post(`/api/v1/admin/articles/${own.id}/transition`).set(author.auth).send({ action: "publish", version: own.version });
    expect(res.status).toBe(200);
    const theirs = await draft(other.auth);
    // Authors cannot even see other people's drafts.
    const peek = await request(ctx.app).get(`/api/v1/admin/articles/${theirs.id}`).set(author.auth);
    expect(peek.status).toBe(404);
  });

  it("blocks publishing when required information is missing", async () => {
    const editor = await staff("editor");
    const res = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "en", title: "Short" });
    const pub = await request(ctx.app)
      .post(`/api/v1/admin/articles/${res.body.data.id}/transition`)
      .set(editor.auth)
      .send({ action: "publish", version: res.body.data.version });
    expect(pub.status).toBe(422);
    expect(pub.body.error.details.checklist).toEqual(expect.arrayContaining(["summary", "body", "category"]));
  });

  it("publishes scheduled stories when their time comes", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const when = new Date(Date.now() + 5 * 60_000);
    const sch = await request(ctx.app)
      .post(`/api/v1/admin/articles/${a.id}/transition`)
      .set(editor.auth)
      .send({ action: "schedule", version: a.version, scheduledFor: when.toISOString() });
    expect(sch.status).toBe(200);
    expect(sch.body.data.status).toBe("scheduled");
    expect((await request(ctx.app).get(`/api/v1/articles/by-slug/${a.slug}?locale=en`)).status).toBe(404);

    expect(await schedulerTick(async () => {}, new Date(), new Date())).toBe(0);
    const tags: string[][] = [];
    expect(await schedulerTick(async (t) => void tags.push(t), new Date(), new Date(when.getTime() + 1000))).toBe(1);
    const doc = await Article.findById(a.id).lean();
    expect(doc!.status).toBe("published");
    expect(doc!.publishedAt!.getTime()).toBe(when.getTime());
    expect(tags.flat()).toContain("articles");
    // Running again does not publish twice.
    expect(await schedulerTick(async () => {}, new Date(), new Date(when.getTime() + 2000))).toBe(0);
  });

  it("rejects schedules in the past", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const res = await request(ctx.app)
      .post(`/api/v1/admin/articles/${a.id}/transition`)
      .set(editor.auth)
      .send({ action: "schedule", version: a.version, scheduledFor: new Date(Date.now() - 1000).toISOString() });
    expect(res.status).toBe(422);
  });

  it("unpublishing removes a story from public view", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const p = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(editor.auth).send({ action: "publish", version: a.version });
    const u = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(editor.auth).send({ action: "unpublish", version: p.body.data.version });
    expect(u.body.data.status).toBe("draft");
    expect((await request(ctx.app).get(`/api/v1/articles/by-slug/${a.slug}?locale=en`)).status).toBe(404);
    expect(ctx.revalidated.at(-1)).toContain(`article:en:${a.slug}`);
  });

  it("keeps old URLs working after a published slug changes", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const p = await request(ctx.app).post(`/api/v1/admin/articles/${a.id}/transition`).set(editor.auth).send({ action: "publish", version: a.version });
    const e = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(editor.auth).send({ version: p.body.data.version, slug: "Bridge plan approved" });
    expect(e.status).toBe(200);
    expect(e.body.data.slug).toBe("bridge-plan-approved");
    const old = await request(ctx.app).get(`/api/v1/articles/by-slug/${a.slug}?locale=en`);
    expect(old.body.redirect).toEqual({ slug: "bridge-plan-approved" });
    expect(ctx.revalidated.flat()).toContain(`article:en:${a.slug}`);
  });

  it("detects conflicting edits with optimistic versioning", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const first = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(editor.auth).send({ version: a.version, title: "First edit" });
    expect(first.status).toBe(200);
    const stale = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(editor.auth).send({ version: a.version, title: "Stale edit" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(first.body.data.version);
  });

  it("sanitizes article HTML to prevent stored XSS", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth, {
      body: '<p onclick="alert(1)">Hi <a href="javascript:alert(1)">x</a> <a href="https://example.org">ok</a></p><script>alert(1)</script><img src="https://evil.example/x.png" onerror="alert(1)"><iframe src="https://evil.example"></iframe>',
      title: '<b>Bold</b> headline<script>x</script>',
    });
    const doc = await Article.findById(a.id).lean();
    expect(doc!.body).not.toMatch(/script|onclick|onerror|javascript:|iframe|evil\.example/i);
    expect(doc!.body).toContain('<a href="https://example.org" rel="noopener noreferrer">ok</a>');
    expect(doc!.title).toBe("Bold headline");
  });

  it("reserves featuring and breaking banners for editors", async () => {
    const author = await staff("author");
    const res = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set(author.auth)
      .send({ locale: "en", title: "Trying to feature", isFeatured: true });
    expect(res.status).toBe(403);
    const a = await draft(author.auth);
    const unchanged = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(author.auth).send({ version: a.version, isFeatured: false, breakingUntil: null });
    expect(unchanged.status).toBe(200);
  });

  it("links translations and refuses a second version in the same language", async () => {
    const editor = await staff("editor");
    const en = await draft(editor.auth);
    const bn = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "bn", title: "সেতু পরিকল্পনা অনুমোদন", translationOf: en.id });
    expect(bn.status).toBe(201);
    expect(bn.body.data.slug).toBe("সেতু-পরিকল্পনা-অনুমোদন");
    expect(bn.body.data.translations[0]).toMatchObject({ locale: "en", id: en.id });
    const dup = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "bn", title: "আবার", translationOf: en.id });
    expect(dup.status).toBe(409);
  });

  it("restores an earlier revision", async () => {
    const editor = await staff("editor");
    const a = await draft(editor.auth);
    const e = await request(ctx.app).patch(`/api/v1/admin/articles/${a.id}`).set(editor.auth).send({ version: a.version, title: "Totally different title" });
    const revs = await request(ctx.app).get(`/api/v1/admin/articles/${a.id}/revisions`).set(editor.auth);
    const original = revs.body.data.at(-1);
    const r = await request(ctx.app)
      .post(`/api/v1/admin/articles/${a.id}/revisions/${original.id}/restore`)
      .set(editor.auth)
      .send({ version: e.body.data.version });
    expect(r.status).toBe(200);
    expect(r.body.data.title).toBe("Council approves new bridge plan");
  });

  it("requires explicit confirmation for bulk actions and checks each story", async () => {
    const author = await staff("author");
    const editor = await staff("editor");
    const a = await draft(author.auth);
    const b = await draft(editor.auth, { title: "Second story" });
    const noConfirm = await request(ctx.app).post("/api/v1/admin/articles/bulk").set(author.auth).send({ ids: [a.id], action: "archive" });
    expect(noConfirm.status).toBe(422);
    const res = await request(ctx.app).post("/api/v1/admin/articles/bulk").set(author.auth).send({ ids: [a.id, b.id], action: "archive", confirm: true });
    expect(res.body.data).toEqual([
      { id: a.id, ok: false, error: "forbidden" },
      { id: b.id, ok: false, error: "not_found" },
    ]);
  });

  it("shows authors only their own work in the dashboard and list", async () => {
    const author = await staff("author");
    const editor = await staff("editor");
    await draft(author.auth);
    await draft(editor.auth, { title: "Editor story" });
    const list = await request(ctx.app).get("/api/v1/admin/articles").set(author.auth);
    expect(list.body.meta.total).toBe(1);
    const dash = await request(ctx.app).get("/api/v1/admin/dashboard").set(author.auth);
    expect(dash.body.data.counts.draft).toBe(1);
    expect(dash.body.data.traffic).toBeNull();
    const edDash = await request(ctx.app).get("/api/v1/admin/dashboard").set(editor.auth);
    expect(edDash.body.data.counts.draft).toBe(2);
    expect(edDash.body.data.traffic.definition).toBeTruthy();
  });
});
