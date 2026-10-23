/**
 * Read-only connectivity check for Firebase Admin credentials.
 *   npm run check-firebase
 */
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FirebaseIdentityProvider } from "../lib/identity.js";

await new FirebaseIdentityProvider().findUidByEmail("connectivity-check@example.invalid");
const app = getApps()[0]!;
const users = await getAuth(app).listUsers(10);
console.log(`Firebase Admin OK. Project: ${app.options.projectId}. Users (first 10): ${users.users.length}`);
for (const u of users.users) console.log(`  - ${u.email ?? "(no email)"} [${u.providerData.map((p) => p.providerId).join(", ")}]`);
