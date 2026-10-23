import request from "supertest";
import { describe, expect, it } from "vitest";
import { UserProfile } from "../src/shared/models.js";
import { cookieSession, idToken, staff, useTestApp } from "./helpers.js";

describe("authentication and sessions", () => {
  const ctx = useTestApp();

  it("requires a CSRF token to create a session", async () => {
    const res = await request(ctx.app).post("/api/v1/auth/session").send({ idToken: idToken("u1") });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("csrf_failed");
  });

  it("exchanges a fresh ID token for an HttpOnly session cookie and creates a reader profile", async () => {
    const agent = request.agent(ctx.app);
    const csrf = await agent.get("/api/v1/auth/csrf");
    const res = await agent.post("/api/v1/auth/session").set("X-CSRF-Token", csrf.body.data.token).send({ idToken: idToken("u2") });
    expect(res.status).toBe(200);
    const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    const session = cookies.find((c) => c.startsWith("khoka_session="));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(res.body.data.role).toBe("reader");
    expect(res.body.data.permissions).toEqual([]);

    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("u2@example.test");
    expect(me.headers["cache-control"]).toContain("no-store");
  });

  it("rejects stale sign-ins, forged tokens and missing sessions", async () => {
    const agent = request.agent(ctx.app);
    const csrf = (await agent.get("/api/v1/auth/csrf")).body.data.token;
    const stale = await agent.post("/api/v1/auth/session").set("X-CSRF-Token", csrf).send({ idToken: idToken("u3", "u3@example.test", 3600) });
    expect(stale.status).toBe(401);
    const forged = await agent.post("/api/v1/auth/session").set("X-CSRF-Token", csrf).send({ idToken: "forged-token-that-is-long-enough" });
    expect(forged.status).toBe(401);
    expect((await request(ctx.app).get("/api/v1/auth/me")).status).toBe(401);
    const badBearer = await request(ctx.app).get("/api/v1/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(badBearer.status).toBe(401);
  });

  it("ignores roles claimed by the client", async () => {
    const agent = request.agent(ctx.app);
    const csrf = (await agent.get("/api/v1/auth/csrf")).body.data.token;
    const res = await agent
      .post("/api/v1/auth/session")
      .set("X-CSRF-Token", csrf)
      .send({ idToken: idToken("u4"), role: "admin" });
    expect(res.status).toBe(422);
    expect(await UserProfile.exists({ firebaseUid: "u4", role: "admin" })).toBeNull();
  });

  it("requires CSRF for cookie-authenticated mutations but not for Bearer tokens", async () => {
    const { profile } = await staff("editor", "editor-csrf");
    const { agent, csrf } = await cookieSession(ctx.app, profile.firebaseUid);
    const without = await agent.post("/api/v1/admin/articles").send({ title: "Hello world", locale: "en" });
    expect(without.status).toBe(403);
    expect(without.body.error.code).toBe("csrf_failed");
    const withToken = await agent.post("/api/v1/admin/articles").set("X-CSRF-Token", csrf).send({ title: "Hello world", locale: "en" });
    expect(withToken.status).toBe(201);
    const bearer = await request(ctx.app)
      .post("/api/v1/admin/articles")
      .set("Authorization", `Bearer ${idToken(profile.firebaseUid)}`)
      .send({ title: "Hello again", locale: "en" });
    expect(bearer.status).toBe(201);
  });

  it("blocks revoked sessions and disabled accounts", async () => {
    const { profile } = await staff("editor", "editor-revoked");
    const { agent } = await cookieSession(ctx.app, profile.firebaseUid);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);
    ctx.identity.revoked.add(profile.firebaseUid);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
    ctx.identity.revoked.clear();

    await UserProfile.updateOne({ _id: profile._id }, { disabled: true });
    expect((await agent.get("/api/v1/auth/me")).status).toBe(403);
  });

  it("signs out by clearing the cookie", async () => {
    const { profile } = await staff("reader", "reader-logout");
    const { agent, csrf } = await cookieSession(ctx.app, profile.firebaseUid);
    const out = await agent.post("/api/v1/auth/logout").set("X-CSRF-Token", csrf);
    expect(out.status).toBe(204);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("enforces role permissions on every admin route", async () => {
    const reader = await staff("reader");
    const author = await staff("author");
    const adManager = await staff("ad_manager");
    const checks: [string, string, Record<string, string>, number][] = [
      ["get", "/api/v1/admin/articles", reader.auth, 403],
      ["get", "/api/v1/admin/users", author.auth, 403],
      ["get", "/api/v1/admin/audit", author.auth, 403],
      ["get", "/api/v1/admin/ads", author.auth, 403],
      ["get", "/api/v1/admin/ads", adManager.auth, 200],
      ["get", "/api/v1/admin/articles", adManager.auth, 403],
      ["put", "/api/v1/admin/settings/homepage", author.auth, 403],
      ["get", "/api/v1/admin/dashboard", author.auth, 200],
      ["get", "/api/v1/admin/articles", {}, 401],
    ];
    for (const [method, url, headers, expected] of checks) {
      const res = await (request(ctx.app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url).set(headers).send({ sections: [] });
      expect(`${method} ${url} -> ${res.status}`).toBe(`${method} ${url} -> ${expected}`);
    }
  });
});
