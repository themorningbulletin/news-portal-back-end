import type { Server } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./create-app.js";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./lib/db.js";
import { FirebaseIdentityProvider } from "./lib/identity.js";
import { logger } from "./lib/logger.js";
import { smtpMailer } from "./lib/mailer.js";
import { cloudinaryStorage } from "./modules/media/media.service.js";
import { webhookRevalidator } from "./lib/revalidate.js";
import { startScheduler } from "./modules/article/article.scheduler.js";

export async function startServer(mongoUri?: string): Promise<Server> {
  const e = env();
  const uri = mongoUri ?? e.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (or run `npm run dev:memory` for a local database)");
  if (mongoose.connection.readyState !== 1) await connectDb(uri);

  const app = createApp({
    identity: new FirebaseIdentityProvider(),
    revalidate: webhookRevalidator,
    storage: cloudinaryStorage,
    mailer: smtpMailer,
  });
  const stopScheduler = e.SCHEDULER_ENABLED ? startScheduler(webhookRevalidator, e.SCHEDULER_INTERVAL_MS) : () => {};

  const server = app.listen(e.PORT, () => {
    logger.info({ port: e.PORT, env: e.NODE_ENV }, "API listening");
    if (e.FIREBASE_AUTH_EMULATOR_HOST) logger.warn("Using the Firebase Auth emulator: development only");
    if (!e.WEB_REVALIDATE_URL) logger.warn("WEB_REVALIDATE_URL not set: the frontend will refresh only when cache lifetimes end");
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 20_000;

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    stopScheduler();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return server;
}
