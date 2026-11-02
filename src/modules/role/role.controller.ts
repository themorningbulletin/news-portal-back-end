import type { Request, Response } from "express";
import { parse } from "../../lib/http.js";
import { audit } from "../audit/audit.service.js";
import * as roles from "./role.service.js";
import { roleCreateSchema, roleParams, roleUpdateSchema, type RoleCreateInput, type RoleUpdateInput } from "./role.validation.js";

export const roleController = {
  async list(_req: Request, res: Response) {
    res.json({ data: await roles.listRoles() });
  },

  async create(req: Request, res: Response) {
    const input = parse(roleCreateSchema, req.body) as RoleCreateInput;
    const key = await roles.createRole(input);
    await audit(req, { action: "role.create", entityType: "role", entityId: key, metadata: { permissions: input.permissions } });
    res.status(201).json({ data: { key } });
  },

  async update(req: Request, res: Response) {
    const { key } = parse(roleParams, req.params);
    const input = parse(roleUpdateSchema, req.body) as RoleUpdateInput;
    await roles.updateRole(key, input);
    await audit(req, { action: "role.update", entityType: "role", entityId: key, metadata: { permissions: input.permissions } });
    res.json({ data: { key } });
  },

  async remove(req: Request, res: Response) {
    const { key } = parse(roleParams, req.params);
    await roles.removeRole(key);
    await audit(req, { action: "role.remove", entityType: "role", entityId: key });
    res.status(204).end();
  },
};
