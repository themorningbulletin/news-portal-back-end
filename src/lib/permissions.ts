import { ROLES } from "../shared/constants.js";

/** Default permissions of the built-in roles. Admins can change them in the newsroom, except where locked below. */
export const PERMISSIONS = {
  "dashboard:read": ["author", "editor", "manager", "sub_admin", "admin"],
  "article:create": ["author", "editor", "manager", "sub_admin", "admin"],
  "article:edit_any": ["editor", "manager", "sub_admin", "admin"],
  "article:publish": ["editor", "manager", "sub_admin", "admin"],
  "article:delete": ["editor", "manager", "sub_admin", "admin"],
  "taxonomy:manage": ["editor", "manager", "sub_admin", "admin"],
  "homepage:manage": ["editor", "manager", "sub_admin", "admin"],
  "pages:manage": ["editor", "manager", "sub_admin", "admin"],
  "media:upload": ["author", "editor", "manager", "sub_admin", "admin"],
  "media:manage_any": ["editor", "manager", "sub_admin", "admin"],
  "newsletter:read": ["editor", "manager", "sub_admin", "admin"],
  "users:manage": ["sub_admin", "admin"],
  "roles:manage": ["admin"],
  "audit:read": ["sub_admin", "admin"],
  "ads:manage": ["ad_manager", "manager", "sub_admin", "admin"],
} as const satisfies Record<string, readonly string[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Whoever can redefine roles can give themselves anything, so this stays with admins and cannot be granted. */
export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ["roles:manage"];

/** Admin always has everything and reader nothing, so nobody can lock the newsroom or open it to the public by accident. */
export const LOCKED_ROLES: readonly string[] = ["admin", "reader"];

const defaultsFor = (role: string) => ALL_PERMISSIONS.filter((p) => (PERMISSIONS[p] as readonly string[]).includes(role));

/** Custom roles and edited built-in roles, as loaded from the database (see role.service.ts). */
let stored = new Map<string, Permission[]>();

export function setStoredRoles(rows: { key: string; permissions: string[] }[]): void {
  stored = new Map(rows.map((r) => [r.key, ALL_PERMISSIONS.filter((p) => r.permissions.includes(p) && !ADMIN_ONLY_PERMISSIONS.includes(p))]));
}

export function permissionsFor(role: string): Permission[] {
  if (role === "admin") return [...ALL_PERMISSIONS];
  if (role === "reader") return [];
  return stored.get(role) ?? defaultsFor(role);
}

export function hasPermission(role: string, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/** Newsroom staff are the people holding at least one permission; readers hold none. */
export const isStaffRole = (role: string) => permissionsFor(role).length > 0;

export const isKnownRole = (role: string) => (ROLES as readonly string[]).includes(role) || stored.has(role);

export function rolesWith(permission: Permission): string[] {
  return [...new Set([...ROLES, ...stored.keys()])].filter((role) => hasPermission(role, permission));
}
