import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface Identity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  /** Seconds since epoch of the user's last real sign-in. */
  authTime: number;
}

/**
 * Firebase is the identity provider. The API never trusts a uid, email or
 * role sent by the browser: identities only come out of these verifiers.
 */
export interface IdentityProvider {
  verifyIdToken(idToken: string): Promise<Identity>;
  createSessionCookie(idToken: string, expiresInMs: number): Promise<string>;
  verifySessionCookie(cookie: string): Promise<Identity>;
  deleteUser(uid: string): Promise<void>;
  findUidByEmail(email: string): Promise<string | null>;
}

export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

function toIdentity(decoded: DecodedIdToken): Identity {
  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: decoded.email_verified === true,
    name: typeof decoded.name === "string" ? decoded.name : undefined,
    authTime: decoded.auth_time,
  };
}

/** Hosting dashboards keep whatever was pasted: surrounding quotes and escaped newlines included. */
export function normalizePrivateKey(raw: string): string {
  return raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .replace(/\\n/g, "\n");
}

/** Reasons only (never the token): a broken credential otherwise looks like a bad sign-in. */
function logFailure(operation: string, err: unknown): void {
  const { code, message } = err as { code?: string; message?: string };
  logger.warn({ code, reason: message?.slice(0, 300) }, `firebase ${operation} failed`);
}

function firebaseApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const e = env();
  if (e.FIREBASE_AUTH_EMULATOR_HOST) {
    // firebase-admin reads this variable itself; the emulator needs no credentials.
    process.env.FIREBASE_AUTH_EMULATOR_HOST = e.FIREBASE_AUTH_EMULATOR_HOST;
    return initializeApp({ projectId: e.FIREBASE_PROJECT_ID ?? "demo-khoka-news" });
  }
  // Environment credentials win: on serverless hosts the service-account file does not exist.
  if (e.FIREBASE_CLIENT_EMAIL && e.FIREBASE_PRIVATE_KEY && e.FIREBASE_PROJECT_ID) {
    return initializeApp({
      credential: cert({
        projectId: e.FIREBASE_PROJECT_ID,
        clientEmail: e.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(e.FIREBASE_PRIVATE_KEY),
      }),
      projectId: e.FIREBASE_PROJECT_ID,
    });
  }
  if (e.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const sa = JSON.parse(readFileSync(resolve(e.FIREBASE_SERVICE_ACCOUNT_PATH), "utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
      projectId: e.FIREBASE_PROJECT_ID ?? sa.project_id,
    });
  }
  // Falls back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or a cloud runtime).
  return initializeApp({ credential: applicationDefault(), projectId: e.FIREBASE_PROJECT_ID });
}

export class FirebaseIdentityProvider implements IdentityProvider {
  private auth() {
    return getAuth(firebaseApp());
  }

  async verifyIdToken(idToken: string): Promise<Identity> {
    try {
      return toIdentity(await this.auth().verifyIdToken(idToken, true));
    } catch (err) {
      logFailure("verifyIdToken", err);
      throw new IdentityError("Invalid or expired ID token");
    }
  }

  async createSessionCookie(idToken: string, expiresInMs: number): Promise<string> {
    try {
      return await this.auth().createSessionCookie(idToken, { expiresIn: expiresInMs });
    } catch (err) {
      logFailure("createSessionCookie", err);
      throw new IdentityError("Could not create a session from this ID token");
    }
  }

  async verifySessionCookie(cookie: string): Promise<Identity> {
    try {
      // checkRevoked=true: disabled users and revoked sessions are rejected immediately.
      return toIdentity(await this.auth().verifySessionCookie(cookie, true));
    } catch {
      throw new IdentityError("Invalid, expired or revoked session");
    }
  }

  async deleteUser(uid: string): Promise<void> {
    await this.auth().deleteUser(uid);
  }

  async findUidByEmail(email: string): Promise<string | null> {
    try {
      return (await this.auth().getUserByEmail(email)).uid;
    } catch {
      return null;
    }
  }
}
