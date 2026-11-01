import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createApp, type AppDeps } from "../src/create-app.js";
import type { Identity, IdentityProvider } from "../src/lib/identity.js";
import { IdentityError } from "../src/lib/identity.js";
import { syncAllIndexes } from "../src/lib/indexes.js";
import { allModels, UserProfile } from "../src/shared/models.js";
import type { Role } from "../src/shared/constants.js";
import type { Mailer, MailMessage } from "../src/lib/mailer.js";
import type { MediaStorage } from "../src/modules/media/media.service.js";

/**
 * Stand-in for Firebase. Tokens look like "test-id-token|<uid>|<email>|<authTimeSecondsAgo>".
 * Anything else is rejected, exactly like a forged or expired Firebase token.
 */
export class FakeIdentity implements IdentityProvider {
  deleted: string[] = [];
  revoked = new Set<string>();

  private parse(token: string, prefix: string): Identity {
    const parts = token.split("|");
    if (parts[0] !== prefix || parts.length !== 4) throw new IdentityError("bad token");
    const [, uid, email, ago] = parts as [string, string, string, string];
    if (this.revoked.has(uid)) throw new IdentityError("revoked");
    return { uid, email, emailVerified: true, authTime: Math.floor(Date.now() / 1000) - Number(ago) };
  }
  async verifyIdToken(t: string) {
    return this.parse(t, "test-id-token");
  }
  async createSessionCookie(t: string) {
    const id = this.parse(t, "test-id-token");
    return `test-session|${id.uid}|${id.email}|0`;
  }
  async verifySessionCookie(c: string) {
    return this.parse(c, "test-session");
  }
  async deleteUser(uid: string) {
    this.deleted.push(uid);
  }
  async findUidByEmail() {
    return null;
  }
}

export const idToken = (uid: string, email = `${uid}@example.test`, authAgoSeconds = 10) =>
  `test-id-token|${uid}|${email}|${authAgoSeconds}`;

export class CapturingMailer implements Mailer {
  sent: MailMessage[] = [];
  available() {
    return true;
  }
  async send(m: MailMessage) {
    this.sent.push(m);
  }
}

export const disabledStorage: MediaStorage = {
  enabled: () => false,
  upload: async () => {
    throw new Error("disabled");
  },
};

export function fakeStorage(): MediaStorage & { uploads: number } {
  const s = {
    uploads: 0,
    enabled: () => true,
    upload: async () => {
      s.uploads++;
      return { publicId: `test/${s.uploads}`, url: `https://res.cloudinary.com/demo/image/upload/test/${s.uploads}.jpg`, width: 1200, height: 800, format: "jpg", bytes: 1234 };
    },
  };
  return s;
}

export interface TestContext {
  app: ReturnType<typeof createApp>;
  identity: FakeIdentity;
  mailer: CapturingMailer;
  revalidated: string[][];
}

/** Connects to the shared in-memory MongoDB with a database per test file and clears it before each test. */
export function useTestApp(overrides: Partial<AppDeps> = {}, dbName = `t${Math.random().toString(36).slice(2, 10)}`) {
  const ctx = {} as TestContext;
  beforeAll(async () => {
    await mongoose.connect(inject("mongoUri"), { dbName });
    await syncAllIndexes();
    ctx.identity = new FakeIdentity();
    ctx.mailer = new CapturingMailer();
    ctx.revalidated = [];
    ctx.app = createApp({
      identity: ctx.identity,
      mailer: ctx.mailer,
      storage: disabledStorage,
      revalidate: async (tags) => {
        ctx.revalidated.push(tags);
      },
      ...overrides,
    });
  });
  beforeEach(async () => {
    for (const m of allModels) await m.collection.deleteMany({});
    ctx.revalidated.length = 0;
    ctx.mailer.sent.length = 0;
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  return ctx;
}

/** A profile with the given role plus an Authorization header for it (Bearer requests skip CSRF by design). */
export async function staff(role: Role, uid = `${role}-${Math.random().toString(36).slice(2, 8)}`, extra: Record<string, unknown> = {}) {
  const profile = await UserProfile.create({ firebaseUid: uid, email: `${uid}@example.test`, displayName: uid, role, ...extra });
  return { profile, auth: { Authorization: `Bearer ${idToken(uid)}` } };
}

/** Signs in through the real cookie flow and returns an agent holding the session and CSRF cookies. */
export async function cookieSession(app: TestContext["app"], uid: string) {
  const agent = request.agent(app);
  const csrf = await agent.get("/api/v1/auth/csrf");
  const res = await agent.post("/api/v1/auth/session").set("X-CSRF-Token", csrf.body.data.token).send({ idToken: idToken(uid) });
  if (res.status !== 200) throw new Error(`session failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: res.body.csrfToken as string };
}
