import { Router } from "express";
import { requirePermission } from "../../middleware/auth.js";
import { noStore } from "../../middleware/cache.js";
import { roleController as c } from "./role.controller.js";

/** /admin/roles */
export function adminRoleRoutes() {
  const r = Router();
  r.use(noStore);
  // Whoever assigns roles needs to see them; only admins may change what a role can do.
  r.get("/", requirePermission("roles:manage", "users:manage"), c.list);
  r.post("/", requirePermission("roles:manage"), c.create);
  r.put("/:key", requirePermission("roles:manage"), c.update);
  r.delete("/:key", requirePermission("roles:manage"), c.remove);
  return r;
}
