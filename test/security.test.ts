import request from "supertest";
import { describe, expect, it } from "vitest";
import { UserProfile } from "../src/shared/models.js";
import { detectImageType } from "../src/modules/media/media.service.js";
import { fakeStorage, staff, useTestApp } from "./helpers.js";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

describe("input validation and abuse protection", () => {
  const storage = fakeStorage();
  const ctx = useTestApp({ storage, rateLimits: { search: 3 } });

  it("rejects NoSQL operator injection in query strings and bodies", async () => {
    const q = await request(ctx.app).get("/api/v1/articles?locale=en&$where=1");
    expect(q.status).toBe(400);
    const editor = await staff("editor");
    const b = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "en", title: { $gt: "" } });
    expect(b.status).toBe(400);
    const nested = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "en", title: "x", seo: { "a.b": 1 } });
    expect(nested.status).toBe(400);
  });

  it("returns field-level validation errors", async () => {
    const editor = await staff("editor");
    const res = await request(ctx.app).post("/api/v1/admin/articles").set(editor.auth).send({ locale: "en", title: "" , unknown: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    const badId = await request(ctx.app).get("/api/v1/admin/articles/not-an-id").set(editor.auth);
    expect(badId.status).toBe(422);
  });

  it("rate-limits search", async () => {
    for (let i = 0; i < 3; i++) expect((await request(ctx.app).get("/api/v1/search?locale=en&q=test")).status).toBe(200);
    const limited = await request(ctx.app).get("/api/v1/search?locale=en&q=test");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
  });

  it("identifies images by signature", () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a" + "x".repeat(10)))).toBe("image/gif");
  });

  it("accepts real images and rejects disguised or disallowed files", async () => {
    const author = await staff("author");
    const ok = await request(ctx.app).post("/api/v1/admin/media").set(author.auth).field("credit", "Photo desk").attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.publicId).toMatch(/^test\//);
    expect(ok.body.data.credit).toBe("Photo desk");

    const disguised = await request(ctx.app).post("/api/v1/admin/media").set(author.auth).attach("file", Buffer.from("<script>alert(1)</script>".repeat(4)), { filename: "x.png", contentType: "image/png" });
    expect(disguised.status).toBe(415);
    const svg = await request(ctx.app).post("/api/v1/admin/media").set(author.auth).attach("file", Buffer.from("<svg></svg>"), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(svg.status).toBe(415);
    const mismatch = await request(ctx.app).post("/api/v1/admin/media").set(author.auth).attach("file", PNG, { filename: "x.jpg", contentType: "image/jpeg" });
    expect(mismatch.status).toBe(415);
    const reader = await staff("reader");
    expect((await request(ctx.app).post("/api/v1/admin/media").set(reader.auth).attach("file", PNG, { filename: "a.png", contentType: "image/png" })).status).toBe(403);
  });

  it("keeps at least one admin and prevents self-demotion", async () => {
    const admin = await staff("admin");
    const self = await request(ctx.app).patch(`/api/v1/admin/users/${admin.profile._id}`).set(admin.auth).send({ role: "editor" });
    expect(self.status).toBe(409);
    const user = await staff("reader");
    const promote = await request(ctx.app).patch(`/api/v1/admin/users/${user.profile._id}`).set(admin.auth).send({ role: "author", canPublish: true });
    expect(promote.status).toBe(200);
    expect((await UserProfile.findById(user.profile._id).lean())!.role).toBe("author");
  });

  it("only accepts numeric ad slot ids and requires one for enabled placements", async () => {
    const admin = await staff("admin");
    const bad = await request(ctx.app).put("/api/v1/admin/ads/home_feed").set(admin.auth).send({ enabled: true, slotId: "", format: "auto", minHeight: 250 });
    expect(bad.status).toBe(422);
    const ok = await request(ctx.app).put("/api/v1/admin/ads/home_feed").set(admin.auth).send({ enabled: true, slotId: "1234567890", format: "auto", minHeight: 250 });
    expect(ok.status).toBe(200);
    const pub = await request(ctx.app).get("/api/v1/ads/placements");
    expect(pub.body.data).toEqual([{ key: "home_feed", slotId: "1234567890", format: "auto", minHeight: 250 }]);
  });
});

describe("media storage not configured", () => {
  const ctx = useTestApp();
  it("reports uploads as unavailable instead of failing obscurely", async () => {
    const author = await staff("author");
    const res = await request(ctx.app).post("/api/v1/admin/media").set(author.auth).attach("file", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("feature_disabled");
  });
});

describe("internal server-to-server key", () => {
  const KEY = "k".repeat(40);
  process.env.INTERNAL_API_KEY = KEY;
  const ctx = useTestApp({ rateLimits: { api: 2 } });

  it("exempts the site's own read requests from the per-IP API budget, but nothing else", async () => {
    const { resetEnvCache } = await import("../src/config/env.js");
    resetEnvCache();
    for (let i = 0; i < 4; i++) {
      expect((await request(ctx.app).get("/api/v1/categories?locale=en").set("x-internal-key", KEY)).status).toBe(200);
    }
    expect((await request(ctx.app).get("/api/v1/categories?locale=en").set("x-internal-key", "wrong".repeat(8))).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/categories?locale=en")).status).toBe(200);
    expect((await request(ctx.app).get("/api/v1/categories?locale=en")).status).toBe(429);
  });
});
