import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { IdentityError, type IdentityProvider } from "../../lib/identity.js";
import { UserProfile } from "../user/user.model.js";

/** Firebase only issues session cookies for sign-ins younger than five minutes. */
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

/**
 * Verifies a fresh Firebase ID token, creates (or refreshes) the app profile
 * and returns a session cookie. New identities always start as readers.
 */
export async function createSession(identity: IdentityProvider, idToken: string) {
  let id;
  try {
    id = await identity.verifyIdToken(idToken);
  } catch (err) {
    if (err instanceof IdentityError) throw new AppError("unauthenticated", "Sign-in could not be verified");
    throw err;
  }
  if (Date.now() / 1000 - id.authTime > MAX_SIGN_IN_AGE_SECONDS) {
    throw new AppError("unauthenticated", "Please sign in again");
  }
  const maxAgeMs = env().SESSION_DAYS * 24 * 60 * 60 * 1000;
  const cookie = await identity.createSessionCookie(idToken, maxAgeMs);

  const profile = await UserProfile.findOneAndUpdate(
    { firebaseUid: id.uid },
    {
      $set: { email: id.email, lastLoginAt: new Date(), ...(id.name ? { displayName: id.name } : {}) },
      $setOnInsert: { firebaseUid: id.uid, role: "reader" },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  if (profile.disabled) throw new AppError("forbidden", "This account is disabled");
  return { cookie, maxAgeMs, profile };
}
