/**
 * Grants the admin role to an existing Firebase user. Run by an operator with
 * database access; there is no default admin account or password.
 *
 *   npm run bootstrap-admin -- --email you@example.com
 *
 * The user must have signed in to Firebase at least once (or exist in the
 * Firebase console). The script refuses to run if an admin already exists,
 * unless --force is passed.
 */
import { parseArgs } from "node:util";
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { FirebaseIdentityProvider } from "../lib/identity.js";
import { AuditLog } from "../modules/audit/audit.model.js";
import { UserProfile } from "../modules/user/user.model.js";

const { values } = parseArgs({ options: { email: { type: "string" }, force: { type: "boolean", default: false } } });
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npm run bootstrap-admin -- --email you@example.com [--force]");
  process.exit(1);
}

const uri = env().MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");
await connectDb(uri);
try {
  if (!values.force && (await UserProfile.exists({ role: "admin" }))) {
    console.error("An admin already exists. Use the CMS user screen, or pass --force deliberately.");
    process.exitCode = 1;
  } else {
    const uid = await new FirebaseIdentityProvider().findUidByEmail(email);
    if (!uid) {
      console.error(`No Firebase user with email ${email}. Sign in once on the site first.`);
      process.exitCode = 1;
    } else {
      const profile = await UserProfile.findOneAndUpdate(
        { firebaseUid: uid },
        { $set: { role: "admin", email, disabled: false }, $setOnInsert: { firebaseUid: uid } },
        { upsert: true, returnDocument: "after" },
      );
      await AuditLog.create({ actor: null, action: "user.bootstrap_admin", entityType: "user", entityId: String(profile._id), summary: email });
      console.log(`Granted admin to ${email} (profile ${profile._id}).`);
    }
  }
} finally {
  await disconnectDb();
}
