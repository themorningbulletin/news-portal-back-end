import { z } from "zod";
import { ALL_PERMISSIONS } from "../../lib/permissions.js";

export const roleKey = z.string().regex(/^[a-z][a-z0-9_-]*$/).max(40);
export const roleParams = z.object({ key: roleKey });

const permissions = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length);
const name = z
  .object({ bn: z.string().trim().max(60).optional(), en: z.string().trim().max(60).optional() })
  .strict()
  .refine((n) => Boolean(n.bn || n.en), { message: "A role needs a name" });

export const roleCreateSchema = z.object({ name, permissions }).strict();
export const roleUpdateSchema = z.object({ name: name.optional(), permissions }).strict();

export type RoleCreateInput = Omit<z.output<typeof roleCreateSchema>, "permissions"> & { permissions: (typeof ALL_PERMISSIONS)[number][] };
export type RoleUpdateInput = Omit<z.output<typeof roleUpdateSchema>, "permissions"> & { permissions: (typeof ALL_PERMISSIONS)[number][] };
