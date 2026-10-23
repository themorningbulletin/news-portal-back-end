import type { HydratedDocument } from "mongoose";
import { type UserProfileDoc } from "./modules/user/user.model.js";
import type { Identity } from "./lib/identity.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: {
        identity: Identity;
        profile: HydratedDocument<UserProfileDoc>;
        via: "cookie" | "bearer";
      };
    }
  }
}

export {};
