import { randomBytes } from "node:crypto";
import { AppError, conflict, notFound } from "../../lib/errors.js";
import { ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, LOCKED_ROLES, permissionsFor, setStoredRoles, type Permission } from "../../lib/permissions.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { ROLES } from "../../shared/constants.js";
import { UserProfile } from "../user/user.model.js";
import { RoleModel } from "./role.model.js";
import type { RoleCreateInput, RoleUpdateInput } from "./role.validation.js";

/** Each API instance re-reads roles this often, so a change reaches every instance within half a minute. */
const CACHE_MS = 30_000;
let loadedAt = 0;
let loading: Promise<void> | undefined;

async function loadRoles() {
  setStoredRoles(await RoleModel.find().select("key permissions").lean());
  loadedAt = Date.now();
}

export function ensureRolesLoaded(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_MS) return Promise.resolve();
  loading ??= loadRoles().finally(() => {
    loading = undefined;
  });
  return loading;
}

/** Test helper: forget loaded roles, as a fresh instance would. */
export function resetRoleCache(): void {
  setStoredRoles([]);
  loadedAt = 0;
}

const isBuiltin = (key: string) => (ROLES as readonly string[]).includes(key);

function assertGrantable(permissions: Permission[]) {
  const blocked = permissions.filter((p) => ADMIN_ONLY_PERMISSIONS.includes(p));
  if (blocked.length) throw new AppError("validation_failed", `These permissions stay with admins: ${blocked.join(", ")}`);
}

function assertEditable(key: string) {
  if (LOCKED_ROLES.includes(key)) throw new AppError("conflict", "This role is fixed and cannot be changed");
}

export async function listRoles() {
  await loadRoles();
  const [custom, counts] = await Promise.all([
    RoleModel.find().select("key name").lean(),
    UserProfile.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);
  const users = new Map(counts.map((c) => [c._id, c.count]));
  const names = new Map(custom.map((r) => [r.key, r.name]));
  const keys = [...ROLES, ...custom.map((r) => r.key).filter((k) => !isBuiltin(k))];
  return {
    roles: keys.map((key) => ({
      key,
      builtin: isBuiltin(key),
      locked: LOCKED_ROLES.includes(key),
      customized: isBuiltin(key) && names.has(key),
      name: isBuiltin(key) ? {} : (names.get(key) ?? {}),
      permissions: permissionsFor(key),
      userCount: users.get(key) ?? 0,
    })),
    permissions: ALL_PERMISSIONS.map((key) => ({ key, adminOnly: ADMIN_ONLY_PERMISSIONS.includes(key) })),
  };
}

export async function createRole(input: RoleCreateInput) {
  assertGrantable(input.permissions);
  const base = (input.name.en ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
  const start = /^[a-z]/.test(base) ? base : "role";
  const key = isBuiltin(start) || (await RoleModel.exists({ key: start })) || start === "role" ? `${start}_${randomBytes(3).toString("hex")}` : start;
  const name = { bn: sanitizePlain(input.name.bn ?? ""), en: sanitizePlain(input.name.en ?? "") };
  await RoleModel.create({ key, name, permissions: input.permissions });
  await loadRoles();
  return key;
}

export async function updateRole(key: string, input: RoleUpdateInput) {
  assertEditable(key);
  assertGrantable(input.permissions);
  const set: Record<string, unknown> = { permissions: input.permissions };
  if (isBuiltin(key)) {
    await RoleModel.updateOne({ key }, { $set: set }, { upsert: true });
  } else {
    if (input.name) set.name = { bn: sanitizePlain(input.name.bn ?? ""), en: sanitizePlain(input.name.en ?? "") };
    const res = await RoleModel.updateOne({ key }, { $set: set });
    if (!res.matchedCount) throw notFound("Role");
  }
  await loadRoles();
}

/** Built-in roles go back to their defaults; a custom role is removed, once nobody holds it. */
export async function removeRole(key: string) {
  assertEditable(key);
  if (!isBuiltin(key)) {
    if (!(await RoleModel.exists({ key }))) throw notFound("Role");
    const holders = await UserProfile.countDocuments({ role: key });
    if (holders) throw conflict(`${holders} user(s) still have this role. Give them another role first.`);
  }
  await RoleModel.deleteOne({ key });
  await loadRoles();
}
