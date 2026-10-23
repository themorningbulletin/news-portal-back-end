import request from "supertest";
import { describe, expect, it } from "vitest";
import { useTestApp } from "./helpers.js";

describe("health and platform", () => {
  const ctx = useTestApp();

  it("reports liveness and readiness", async () => {
    const live = await request(ctx.app).get("/api/v1/health");
    expect(live.status).toBe(200);
    expect(live.body.status).toBe("ok");
    const ready = await request(ctx.app).get("/api/v1/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.database).toBe(true);
  });

  it("serves an OpenAPI document", async () => {
    const res = await request(ctx.app).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/admin/articles/{id}/transition"]).toBeDefined();
  });

  it("returns a consistent JSON error with a request id for unknown routes", async () => {
    const res = await request(ctx.app).get("/api/v1/nope").set("X-Request-Id", "abcdef12-test");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "not_found", requestId: "abcdef12-test" });
    expect(res.headers["x-request-id"]).toBe("abcdef12-test");
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("only allows configured CORS origins", async () => {
    const ok = await request(ctx.app).get("/api/v1/health").set("Origin", "http://localhost:3000");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const bad = await request(ctx.app).get("/api/v1/health").set("Origin", "https://evil.example");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects oversized and malformed JSON bodies safely", async () => {
    const big = await request(ctx.app)
      .post("/api/v1/newsletter/subscribe")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.co", locale: "en", website: "x".repeat(1_100_000) }));
    expect(big.status).toBe(413);
    const bad = await request(ctx.app).post("/api/v1/newsletter/subscribe").set("Content-Type", "application/json").send("{oops");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("bad_request");
  });
});
