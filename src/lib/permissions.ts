import type { Role } from "../shared/constants.js";

export const PERMISSIONS = {
  "dashboard:read": ["author", "editor", "admin"],
  "article:create": ["author", "editor", "admin"],
  "article:edit_any": ["editor", "admin"],
  "article:publish": ["editor", "admin"],
  "taxonomy:manage": ["editor", "admin"],
  "homepage:manage": ["editor", "admin"],
  "pages:manage": ["editor", "admin"],
  "media:upload": ["author", "editor", "admin"],
  "media:manage_any": ["editor", "admin"],
  "newsletter:read": ["editor", "admin"],
  "users:manage": ["admin"],
  "audit:read": ["admin"],
  "ads:manage": ["ad_manager", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => hasPermission(role, p));
}

export const STAFF_ROLES: readonly Role[] = ["author", "editor", "admin", "ad_manager", "moderator"];
