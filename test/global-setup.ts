import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer | undefined;

export async function setup({ provide }: { provide: (key: "mongoUri", value: string) => void }) {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  provide("mongoUri", mongo.getUri());
}

export async function teardown() {
  await mongo?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
