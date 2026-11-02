import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../src/seed/run.js";
import { Article, UserProfile } from "../src/shared/models.js";
import { idToken, staff, useTestApp } from "./helpers.js";

const ROLES = "/api/v1/admin/roles";

describe("role management", () => {
  const ctx = useTestApp();
  const asAdmin = async () => (await staff("admin")).auth;

  it("is for admins only", async () => {
    expect((await request(ctx.app).get(ROLES).set((await staff("editor")).auth)).status).toBe(403);
    expect((await request(ctx.app).get(ROLES)).status).toBe(401);
    const res = await request(ctx.app).get(ROLES).set(await asAdmin());
    expect(res.status).toBe(200);
    const admin = res.body.data.roles.find((r: { key: string }) => r.key === "admin");
    expect(admin).toMatchObject({ locked: true, builtin: true, userCount: 1 });
    expect(res.body.data.permissions.find((p: { key: string }) => p.key === "roles:manage").adminOnly).toBe(true);
  });

  it("creates a custom role whose permissions really apply, and removes it once unused", async () => {
    const auth = await asAdmin();
    const created = await request(ctx.app).post(ROLES).set(auth).send({ name: { en: "Copy Desk", bn: "কপি ডেস্ক" }, permissions: ["article:create", "article:edit_any", "dashboard:read"] });
    expect(created.status).toBe(201);
    const { key } = created.body.data;
    expect(key).toBe("copy_desk");

    const person = await staff("reader");
    expect((await request(ctx.app).patch(`/api/v1/admin/users/${person.profile._id}`).set(auth).send({ role: key })).status).toBe(200);
    const me = await request(ctx.app).get("/api/v1/auth/me").set(person.auth);
    expect(me.body.data.permissions.sort()).toEqual(["article:create", "article:edit_any", "dashboard:read"]);
    expect((await request(ctx.app).get("/api/v1/admin/articles").set(person.auth)).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/admin/seo/overview").set(person.auth)).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/admin/audit").set(person.auth)).status).toBe(403);
    expect((await request(ctx.app).get("/api/v1/admin/users/staff").set(auth)).body.data.some((s: { id: string }) => s.id === String(person.profile._id))).toBe(true);

    const blocked = await request(ctx.app).delete(`${ROLES}/${key}`).set(auth);
    expect(blocked.status).toBe(409);
    await request(ctx.app).patch(`/api/v1/admin/users/${person.profile._id}`).set(auth).send({ role: "reader" }).expect(200);
    expect((await request(ctx.app).delete(`${ROLES}/${key}`).set(auth)).status).toBe(204);
    expect((await request(ctx.app).patch(`/api/v1/admin/users/${person.profile._id}`).set(auth).send({ role: key })).status).toBe(422);
  });

  it("never lets anyone hand out admin powers or change the fixed roles", async () => {
    const auth = await asAdmin();
    expect((await request(ctx.app).post(ROLES).set(auth).send({ name: { en: "Sneaky" }, permissions: ["roles:manage"] })).status).toBe(422);
    expect((await request(ctx.app).put(`${ROLES}/editor`).set(auth).send({ permissions: ["roles:manage"] })).status).toBe(422);
    expect((await request(ctx.app).put(`${ROLES}/admin`).set(auth).send({ permissions: [] })).status).toBe(409);
    expect((await request(ctx.app).put(`${ROLES}/reader`).set(auth).send({ permissions: ["article:create"] })).status).toBe(409);
    expect((await request(ctx.app).post(ROLES).set(auth).send({ name: {}, permissions: [] })).status).toBe(422);
  });

  it("changes a built-in role and can reset it to its defaults", async () => {
    const auth = await asAdmin();
    const author = await staff("author");
    await request(ctx.app).put(`${ROLES}/author`).set(auth).send({ permissions: ["dashboard:read"] }).expect(200);
    expect((await request(ctx.app).get("/api/v1/admin/articles").set(author.auth)).status).toBe(403);
    expect((await request(ctx.app).delete(`${ROLES}/author`).set(auth)).status).toBe(204);
    expect((await request(ctx.app).get("/api/v1/admin/articles").set(author.auth)).status).toBe(200);
  });

  it("adds staff by email: a new account gets a one-time link, an existing one just the role", async () => {
    const auth = await asAdmin();
    const created = await request(ctx.app).post("/api/v1/admin/users/invite").set(auth).send({ email: "New.Person@Example.test", role: "editor", displayName: "New Person" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ created: true, user: { email: "new.person@example.test", role: "editor" } });
    expect(created.body.data.resetLink).toContain("new.person@example.test");

    ctx.identity.known.set("old@example.test", "old-uid");
    const reader = await UserProfile.create({ firebaseUid: "old-uid", email: "old@example.test", role: "reader" });
    const again = await request(ctx.app).post("/api/v1/admin/users/invite").set(auth).send({ email: "old@example.test", role: "author" });
    expect(again.status).toBe(201);
    expect(again.body.data).toMatchObject({ created: false, resetLink: null, user: { role: "author" } });
    expect((await UserProfile.findById(reader._id))!.role).toBe("author");

    expect((await request(ctx.app).post("/api/v1/admin/users/invite").set(auth).send({ email: "x@example.test", role: "made_up" })).status).toBe(422);
    expect((await request(ctx.app).post("/api/v1/admin/users/invite").set((await staff("manager")).auth).send({ email: "y@example.test", role: "admin" })).status).toBe(403);
  });

  it("a manager runs the newsroom but not its people", async () => {
    const { auth } = await staff("manager");
    expect((await request(ctx.app).get("/api/v1/admin/articles").set(auth)).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/admin/ads").set(auth)).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/admin/users").set(auth)).status).toBe(403);
    expect((await request(ctx.app).get(ROLES).set(auth)).status).toBe(403);
  });

  it("a sub-admin manages staff but cannot reach or create admin power", async () => {
    const sub = await staff("sub_admin");
    const admin = await staff("admin");
    const otherSub = await staff("sub_admin");
    const reader = await staff("reader");
    const users = (id: unknown) => `/api/v1/admin/users/${String(id)}`;

    expect((await request(ctx.app).get(ROLES).set(sub.auth)).status).toBe(200);
    expect((await request(ctx.app).patch(users(reader.profile._id)).set(sub.auth).send({ role: "editor" })).status).toBe(200);
    expect((await request(ctx.app).patch(users(reader.profile._id)).set(sub.auth).send({ role: "admin" })).status).toBe(403);
    expect((await request(ctx.app).patch(users(reader.profile._id)).set(sub.auth).send({ role: "sub_admin" })).status).toBe(403);
    expect((await request(ctx.app).patch(users(admin.profile._id)).set(sub.auth).send({ disabled: true })).status).toBe(403);
    expect((await request(ctx.app).patch(users(otherSub.profile._id)).set(sub.auth).send({ role: "reader" })).status).toBe(403);
    expect((await request(ctx.app).patch(users(sub.profile._id)).set(sub.auth).send({ role: "admin" })).status).toBe(403);
    expect((await request(ctx.app).post("/api/v1/admin/users/invite").set(sub.auth).send({ email: "boss@example.test", role: "admin" })).status).toBe(403);
    expect((await request(ctx.app).post(ROLES).set(sub.auth).send({ name: { en: "Mine" }, permissions: ["users:manage"] })).status).toBe(403);
    expect((await request(ctx.app).put(`${ROLES}/editor`).set(sub.auth).send({ permissions: [] })).status).toBe(403);
    expect((await request(ctx.app).patch(users(sub.profile._id)).set(admin.auth).send({ role: "manager" })).status).toBe(200);
  });

  it("a new sign-in still starts as a reader", async () => {
    const res = await request(ctx.app).get("/api/v1/auth/me").set("Authorization", `Bearer ${idToken("brand-new")}`);
    expect(res.body.data).toMatchObject({ role: "reader", permissions: [] });
  });
});

describe("homepage curation order", () => {
  const ctx = useTestApp();
  const home = async () => (await request(ctx.app).get("/api/v1/homepage?locale=en")).body.data;
  beforeEach(async () => {
    await seedDatabase();
  });

  const save = async (auth: Record<string, string>, id: unknown, body: Record<string, unknown>) => {
    const current = await Article.findById(id);
    return request(ctx.app).patch(`/api/v1/admin/articles/${String(id)}`).set(auth).send({ ...body, version: current!.version, revision: "manual" });
  };

  it("the story pinned last becomes the lead, even when it is older", async () => {
    const { auth } = await staff("editor");
    const until = new Date(Date.now() + 86_400_000).toISOString();
    const stories = await Article.find({ locale: "en", status: "published" }).sort({ publishedAt: -1 }).limit(30);
    const newer = stories[0]!;
    const older = stories.at(-1)!;
    await save(auth, newer._id, { pinnedUntil: until }).then((r) => expect(r.status).toBe(200));
    expect((await home()).lead.id).toBe(String(newer._id));
    await save(auth, older._id, { pinnedUntil: until }).then((r) => expect(r.status).toBe(200));
    expect((await home()).lead.id).toBe(String(older._id));
    // Saving other fields does not change who was pinned last.
    await save(auth, newer._id, { pinnedUntil: until, summary: "A slightly edited summary for this story." }).then((r) => expect(r.status).toBe(200));
    expect((await home()).lead.id).toBe(String(older._id));
  });

  it("a story ticked for top stories appears there, even when it is older", async () => {
    const { auth } = await staff("editor");
    const older = (await Article.find({ locale: "en", status: "published", isFeatured: false }).sort({ publishedAt: 1 }).limit(1))[0]!;
    const before = await home();
    expect(before.top.map((a: { id: string }) => a.id)).not.toContain(String(older._id));
    await save(auth, older._id, { isFeatured: true }).then((r) => expect(r.status).toBe(200));
    const after = await home();
    expect([after.lead.id, ...after.top.map((a: { id: string }) => a.id)]).toContain(String(older._id));
  });

  it("an editor's pick ticked last comes first", async () => {
    const { auth } = await staff("editor");
    const older = (await Article.find({ locale: "en", status: "published", isEditorsPick: false }).sort({ publishedAt: 1 }).limit(1))[0]!;
    await save(auth, older._id, { isEditorsPick: true }).then((r) => expect(r.status).toBe(200));
    expect((await home()).editorsPicks[0].id).toBe(String(older._id));
  });
});
