import { pino } from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env().NODE_ENV === "test" ? "silent" : env().LOG_LEVEL,
  base: { service: "khoka-news-api" },
  // Never write credentials or session material to logs.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-csrf-token']",
      "req.headers['x-revalidate-secret']",
      "res.headers['set-cookie']",
      "*.idToken",
      "*.token",
      "*.password",
    ],
    censor: "[redacted]",
  },
  ...(env().NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } } }
    : {}),
});
