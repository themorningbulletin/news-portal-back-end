import { logger } from "./lib/logger.js";
import { startServer } from "./start.js";

startServer().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
