import { Router } from "express";
import { bookmarkController as c } from "./bookmark.controller.js";

/** /me/bookmarks (authentication and CSRF are applied by the parent /me router). */
export function bookmarkRoutes() {
  const r = Router();
  r.get("/ids", c.ids);
  r.get("/", c.list);
  r.put("/:group", c.add);
  r.delete("/:group", c.remove);
  return r;
}
