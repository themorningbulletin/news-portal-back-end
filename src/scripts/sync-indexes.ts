import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { syncAllIndexes } from "../lib/indexes.js";

const uri = env().MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");
await connectDb(uri);
try {
  await syncAllIndexes();
} finally {
  await disconnectDb();
}
