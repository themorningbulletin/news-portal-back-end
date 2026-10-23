import type { Request, Response } from "express";
import { parse } from "../../lib/http.js";
import type { Revalidator } from "../../lib/revalidate.js";
import { audit } from "../audit/audit.service.js";
import * as ads from "./ad.service.js";
import { adPlacementSchema, placementKey } from "./ad.validation.js";

export function createAdController(deps: { revalidate: Revalidator }) {
  return {
    async publicList(_req: Request, res: Response) {
      res.json({ data: await ads.publicPlacements() });
    },

    async adminList(_req: Request, res: Response) {
      res.json({ data: await ads.allPlacements() });
    },

    async save(req: Request, res: Response) {
      const key = parse(placementKey, req.params.key);
      const input = parse(adPlacementSchema, req.body);
      const saved = await ads.savePlacement(key, input, req.auth!.profile._id);
      await audit(req, { action: "ads.update", entityType: "ad_placement", entityId: key, metadata: { enabled: input.enabled } });
      await deps.revalidate(["ads"]);
      res.json({ data: saved });
    },
  };
}
