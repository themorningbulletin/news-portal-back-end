/**
 *   npm run seed            add demo content to an empty database
 *   npm run seed -- --reset wipe every collection, then add demo content
 *
 * Refuses to run in production: demo content must never reach readers.
 */
import { parseArgs } from "node:util";
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { syncAllIndexes } from "../lib/indexes.js";
import { seedDatabase } from "../seed/run.js";

const { values } = parseArgs({ options: { reset: { type: "boolean", default: false } } });
const e = env();
if (e.NODE_ENV === "production") {
  console.error("Refusing to seed demo content with NODE_ENV=production.");
  process.exit(1);
}
if (!e.MONGODB_URI) throw new Error("MONGODB_URI is not set");
await connectDb(e.MONGODB_URI);
try {
  await syncAllIndexes();
  await seedDatabase({ reset: values.reset });
} finally {
  await disconnectDb();
}
