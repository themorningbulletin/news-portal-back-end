import { z } from "zod";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    MONGODB_URI: optionalString,
    // Comma-separated list of origins allowed to call the API directly from a browser.
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    // Number of reverse-proxy hops to trust for client IPs (Next.js rewrite = 1).
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
    SESSION_DAYS: z.coerce.number().int().min(1).max(14).default(5),

    FIREBASE_PROJECT_ID: optionalString,
    FIREBASE_CLIENT_EMAIL: optionalString,
    FIREBASE_PRIVATE_KEY: optionalString,
    FIREBASE_AUTH_EMULATOR_HOST: optionalString,
    /** Path to the service-account JSON downloaded from the Firebase console (never commit it). */
    FIREBASE_SERVICE_ACCOUNT_PATH: optionalString,

    WEB_BASE_URL: z.url().default("http://localhost:3000"),
    WEB_REVALIDATE_URL: optionalString.pipe(z.url().optional()),
    REVALIDATE_SECRET: optionalString,
    // Shared with the Next.js server so its cached server-side reads are not rate-limited as one IP.
    INTERNAL_API_KEY: optionalString,

    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    CLOUDINARY_FOLDER: z.string().default("khoka-news"),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(100_000).max(25_000_000).default(8_000_000),

    SMTP_URL: optionalString,
    MAIL_FROM: optionalString,

    /** Scales every rate limit; only for automated test environments (refused in production unless 1). */
    RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(100).default(1),
    SCHEDULER_ENABLED: boolish.default(true),
    SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(5_000).max(600_000).default(30_000),
  })
  .superRefine((env, ctx) => {
    for (const key of ["REVALIDATE_SECRET", "INTERNAL_API_KEY"] as const) {
      if (env[key] && env[key].length < 32) ctx.addIssue({ code: "custom", path: [key], message: "must be at least 32 characters" });
    }
    if (env.NODE_ENV !== "production") return;
    const required = ["MONGODB_URI", "FIREBASE_PROJECT_ID", "WEB_REVALIDATE_URL", "REVALIDATE_SECRET", "INTERNAL_API_KEY"] as const;
    for (const key of required) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "is required in production" });
    }
    if (env.RATE_LIMIT_MULTIPLIER !== 1) {
      ctx.addIssue({ code: "custom", path: ["RATE_LIMIT_MULTIPLIER"], message: "must be 1 in production" });
    }
    if (env.FIREBASE_AUTH_EMULATOR_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["FIREBASE_AUTH_EMULATOR_HOST"],
        message: "must not be set in production (the emulator accepts unsigned tokens)",
      });
    }
    if (!env.WEB_BASE_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["WEB_BASE_URL"], message: "must use https in production" });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper: re-read process.env on the next env() call. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const features = {
  mediaUploads: (e: Env = env()) => Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET),
  email: (e: Env = env()) => Boolean(e.SMTP_URL && e.MAIL_FROM),
};
