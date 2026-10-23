import { z } from "zod";
import { AD_PLACEMENT_KEYS } from "../../shared/constants.js";

export const placementKey = z.enum(AD_PLACEMENT_KEYS);

export const adPlacementSchema = z
  .object({
    enabled: z.boolean(),
    slotId: z.union([z.literal(""), z.string().regex(/^\d{6,20}$/, "slot ids are numeric")]),
    format: z.enum(["auto", "rectangle", "horizontal", "fluid"]),
    minHeight: z.number().int().min(50).max(600),
  })
  .strict();
export type AdPlacementInput = z.infer<typeof adPlacementSchema>;
