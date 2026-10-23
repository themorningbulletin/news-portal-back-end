/**
 * Local development without installing MongoDB: starts a MongoDB server
 * from the mongodb-memory-server binary, keeps its data in ./.data/mongo
 * between restarts, seeds demo content on first run, then starts the API.
 * Never use this in production.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "../config/env.js";
import { connectDb } from "../lib/db.js";
import { syncAllIndexes } from "../lib/indexes.js";
import { logger } from "../lib/logger.js";
import { seedDatabase } from "../seed/run.js";
import { startServer } from "../start.js";

if (env().NODE_ENV === "production") throw new Error("dev:memory is for local development only");

const persistent = process.env.DEV_MEMORY_EPHEMERAL !== "true";
const dbPath = resolve(".data/mongo");
if (persistent) mkdirSync(dbPath, { recursive: true });

const mongo = await MongoMemoryServer.create({
  instance: {
    port: Number(process.env.DEV_MONGO_PORT ?? 27027),
    launchTimeout: 60_000,
    ...(persistent ? { dbPath, storageEngine: "wiredTiger" as const } : {}),
  },
});
const uri = mongo.getUri("khoka-news");
logger.info({ uri, persistent }, "local MongoDB started");

await connectDb(uri);
await syncAllIndexes();
await seedDatabase();
// mongodb-memory-server stops its mongod child automatically when this process exits.
await startServer(uri);
