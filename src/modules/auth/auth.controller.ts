import type { Request, Response } from "express";
import { z } from "zod";
import { parse } from "../../lib/http.js";
import type { IdentityProvider } from "../../lib/identity.js";
import { clearSessionCookie, issueCsrfToken, setSessionCookie } from "../../middleware/auth.js";
import { serializeMe } from "../user/user.serializer.js";
import { createSession } from "./auth.service.js";

const sessionSchema = z.object({ idToken: z.string().min(20).max(5000) }).strict();

export function createAuthController(deps: { identity: IdentityProvider }) {
  return {
    csrf(_req: Request, res: Response) {
      res.json({ data: { token: issueCsrfToken(res) } });
    },

    /** Exchanges a fresh Firebase ID token for an HttpOnly session cookie. */
    async session(req: Request, res: Response) {
      const { idToken } = parse(sessionSchema, req.body);
      const { cookie, maxAgeMs, profile } = await createSession(deps.identity, idToken);
      setSessionCookie(res, cookie, maxAgeMs);
      res.json({ data: serializeMe(profile), csrfToken: issueCsrfToken(res) });
    },

    logout(_req: Request, res: Response) {
      clearSessionCookie(res);
      res.status(204).end();
    },

    me(req: Request, res: Response) {
      res.json({ data: serializeMe(req.auth!.profile) });
    },
  };
}
