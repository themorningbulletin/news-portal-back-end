import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { parse } from "../../lib/http.js";
import type { Mailer } from "../../lib/mailer.js";
import * as newsletter from "./newsletter.service.js";
import { subscribeSchema, tokenSchema } from "./newsletter.validation.js";

export function createNewsletterController(deps: { mailer: Mailer }) {
  return {
    /** Always 202 with the same body; honeypot submissions are dropped silently. */
    async subscribe(req: Request, res: Response) {
      if (!deps.mailer.available()) throw new AppError("feature_disabled", "The newsletter is not available");
      const body = parse(subscribeSchema, req.body);
      if (!body.website) await newsletter.subscribe(deps.mailer, body.email, body.locale);
      res.status(202).json({ data: { status: "check_your_inbox" } });
    },

    /** A POST from a page with a button, so link scanners cannot confirm on the reader's behalf. */
    async confirm(req: Request, res: Response) {
      await newsletter.confirm(parse(tokenSchema, req.body).token);
      res.json({ data: { status: "active" } });
    },

    async unsubscribe(req: Request, res: Response) {
      await newsletter.unsubscribe(parse(tokenSchema, req.body).token);
      res.json({ data: { status: "unsubscribed" } });
    },
  };
}
