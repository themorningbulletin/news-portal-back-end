import type { Request, Response } from "express";
import { dashboardFor } from "./dashboard.service.js";

export const dashboardController = {
  async get(req: Request, res: Response) {
    res.json({ data: await dashboardFor(req.auth!.profile) });
  },
};
