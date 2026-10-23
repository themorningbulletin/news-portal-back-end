import { allModels } from "../shared/models.js";
import { logger } from "./logger.js";

/** Creates every declared index and drops indexes no longer declared in the schemas. */
export async function syncAllIndexes(): Promise<void> {
  for (const model of allModels) {
    const dropped = await model.syncIndexes();
    if (dropped.length) logger.info({ model: model.modelName, dropped }, "dropped stale indexes");
  }
  logger.info({ models: allModels.length }, "indexes in sync");
}
