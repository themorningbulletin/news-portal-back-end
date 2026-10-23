import type { Types } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { AD_PLACEMENT_KEYS, type AdPlacementKey } from "../../shared/constants.js";
import { AdPlacement } from "./ad.model.js";
import type { AdPlacementInput } from "./ad.validation.js";

/** Only enabled placements with a slot id; the publisher id comes from the frontend environment. */
export async function publicPlacements() {
  const docs = await AdPlacement.find({ enabled: true, slotId: { $type: "string" } }).lean();
  return docs.map((d) => ({ key: d.key, slotId: d.slotId, format: d.format, minHeight: d.minHeight }));
}

export async function allPlacements() {
  const docs = await AdPlacement.find().lean();
  const byKey = new Map(docs.map((d) => [d.key, d]));
  return AD_PLACEMENT_KEYS.map((key) => {
    const d = byKey.get(key);
    return { key, enabled: d?.enabled ?? false, slotId: d?.slotId ?? "", format: d?.format ?? "auto", minHeight: d?.minHeight ?? 250 };
  });
}

export async function savePlacement(key: AdPlacementKey, input: AdPlacementInput, updatedBy: Types.ObjectId) {
  if (input.enabled && !input.slotId) throw new AppError("validation_failed", "An enabled placement needs a slot id");
  const set: Record<string, unknown> = { enabled: input.enabled, format: input.format, minHeight: input.minHeight, updatedBy };
  const update: Record<string, unknown> = { $set: set, $setOnInsert: { key } };
  if (input.slotId) set.slotId = input.slotId;
  else update.$unset = { slotId: "" };
  await AdPlacement.updateOne({ key }, update, { upsert: true, runValidators: true });
  return { key, ...input };
}
