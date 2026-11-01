import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { createApp } from "./create-app.js";
import { env } from "./config/env.js";
import { connectDb } from "./lib/db.js";
import { FirebaseIdentityProvider } from "./lib/identity.js";
import { smtpMailer } from "./lib/mailer.js";
import { webhookRevalidator } from "./lib/revalidate.js";
import { createThrottledTick } from "./modules/article/article.scheduler.js";
import { cloudinaryStorage } from "./modules/media/media.service.js";

/**
 * Vercel entrypoint: the Express app as a default export, with no listen().
 * Long-running servers use server.ts instead. Each instance keeps one small
 * connection pool, reused across requests.
 */
let connecting: Promise<unknown> | undefined;

function ensureDb(): Promise<unknown> {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  const uri = env().MONGODB_URI;
  if (!uri) return Promise.reject(new Error("MONGODB_URI is not set"));
  connecting ??= connectDb(uri, 5).catch((err: unknown) => {
    connecting = undefined;
    throw err;
  });
  return connecting;
}

const tick = createThrottledTick(webhookRevalidator, env().SCHEDULER_INTERVAL_MS);

const prepare: RequestHandler = async (_req, _res, next) => {
  try {
    await ensureDb();
    await tick();
    next();
  } catch (err) {
    next(err);
  }
};

export default createApp({
  identity: new FirebaseIdentityProvider(),
  revalidate: webhookRevalidator,
  storage: cloudinaryStorage,
  mailer: smtpMailer,
  prepare,
});
