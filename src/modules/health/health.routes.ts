import { Router } from "express";
import mongoose from "mongoose";
import { openApiDocument } from "../../openapi.js";

/** Liveness, readiness (database ping) and the OpenAPI document. */
export function healthRoutes() {
  const r = Router();
  r.get("/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ status: "ok", uptime: Math.round(process.uptime()) });
  });
  r.get("/ready", async (_req, res) => {
    let ok = false;
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.db!.admin().ping();
        ok = true;
      } catch {
        ok = false;
      }
    }
    res.set("Cache-Control", "no-store").status(ok ? 200 : 503).json({ status: ok ? "ready" : "unavailable", database: ok });
  });
  r.get("/openapi.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300").json(openApiDocument);
  });
  return r;
}
