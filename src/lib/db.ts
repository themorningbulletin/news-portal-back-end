import mongoose from "mongoose";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

export async function connectDb(uri: string): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 30_000,
    // Indexes are created explicitly with `npm run sync-indexes` (and by the seed/dev scripts).
    autoIndex: false,
  });
  logger.info({ db: conn.connection.name }, "connected to MongoDB");
  return conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
