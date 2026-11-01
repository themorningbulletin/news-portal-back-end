import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type RequestHandler } from "express";
import helmetModule, { type HelmetOptions } from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import type { IdentityProvider } from "./lib/identity.js";
import { logger } from "./lib/logger.js";
import type { Mailer } from "./lib/mailer.js";
import type { Revalidator } from "./lib/revalidate.js";
import { authenticate, requireAuth, requireCsrf } from "./middleware/auth.js";
import { noStore } from "./middleware/cache.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { noOperatorKeys } from "./middleware/no-operator-keys.js";
import { createRateLimiters, defaultRateLimits, type RateLimitConfig } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { adRoutes, adminAdRoutes } from "./modules/ad/ad.routes.js";
import { adminArticleRoutes, articleRoutes, cronRoutes } from "./modules/article/article.routes.js";
import { adminAuditRoutes } from "./modules/audit/audit.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { bookmarkRoutes } from "./modules/bookmark/bookmark.routes.js";
import { adminCategoryRoutes, categoryRoutes } from "./modules/category/category.routes.js";
import { adminDashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import type { MediaStorage } from "./modules/media/media.service.js";
import { adminMediaRoutes } from "./modules/media/media.routes.js";
import { newsletterRoutes } from "./modules/newsletter/newsletter.routes.js";
import { adminPageRoutes, pageRoutes } from "./modules/page/page.routes.js";
import { adminSettingsRoutes, configRoutes } from "./modules/settings/settings.routes.js";
import { adminSeoRoutes } from "./modules/seo/seo.routes.js";
import { adminTagRoutes, tagRoutes } from "./modules/tag/tag.routes.js";
import { adminUserRoutes, authorRoutes, meRoutes } from "./modules/user/user.routes.js";

// Vercel's compiler resolves helmet's CommonJS typings, where the default import is the module object.
const helmet = helmetModule as unknown as (options?: Readonly<HelmetOptions>) => RequestHandler;

export interface AppDeps {
  identity: IdentityProvider;
  revalidate: Revalidator;
  storage: MediaStorage;
  mailer: Mailer;
  rateLimits?: Partial<RateLimitConfig>;
  /** Runs before every API route (serverless: open the database connection). */
  prepare?: RequestHandler;
}

export function createApp(deps: AppDeps) {
  const e = env();
  const app = express();
  const scaled = Object.fromEntries(Object.entries(defaultRateLimits).map(([k, v]) => [k, v * e.RATE_LIMIT_MULTIPLIER])) as unknown as RateLimitConfig;
  const limiters = createRateLimiters({ ...scaled, ...deps.rateLimits });
  const { identity, revalidate, storage, mailer } = deps;

  app.disable("x-powered-by");
  app.set("trust proxy", e.TRUST_PROXY);
  // Express 5 defaults to the "simple" parser: no nested objects from query strings.
  app.set("query parser", "simple");

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      // JSON API: nothing here should ever be framed or executed as a document.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin: e.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization", "X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(cookieParser());
  app.use(noOperatorKeys);
  app.use((req, res, next) => {
    // Long-running requests are cut off rather than holding connections open.
    res.setTimeout(30_000, () => {
      if (!res.headersSent) res.status(503).json({ error: { code: "timeout", message: "Request timed out", requestId: req.id } });
    });
    next();
  });

  const v1 = Router();
  v1.use(limiters.api);
  v1.use(healthRoutes());
  v1.use("/internal/cron", cronRoutes({ revalidate }));
  v1.use(authenticate(identity));

  // Accounts
  v1.use("/auth", authRoutes({ identity, limiters }));
  const me = Router();
  me.use(requireAuth, requireCsrf, limiters.write, noStore);
  me.use("/bookmarks", bookmarkRoutes());
  me.use(meRoutes({ identity, revalidate }));
  v1.use("/me", me);
  v1.use("/newsletter", newsletterRoutes({ mailer, limiters }));

  // Newsroom (CMS): every route checks its own permission.
  const admin = Router();
  admin.use(requireCsrf, limiters.write);
  admin.use("/articles", adminArticleRoutes({ revalidate }));
  admin.use("/media", adminMediaRoutes({ storage, revalidate }));
  admin.use("/categories", adminCategoryRoutes({ revalidate }));
  admin.use("/tags", adminTagRoutes({ revalidate }));
  admin.use("/users", adminUserRoutes({ identity, revalidate }));
  admin.use("/settings", adminSettingsRoutes({ revalidate, mailer }));
  admin.use("/ads", adminAdRoutes({ revalidate }));
  admin.use("/pages", adminPageRoutes({ revalidate }));
  admin.use("/dashboard", adminDashboardRoutes());
  admin.use("/audit", adminAuditRoutes());
  admin.use("/seo", adminSeoRoutes());
  v1.use("/admin", admin);

  // Public reading
  v1.use("/config", configRoutes({ revalidate, mailer }));
  v1.use(articleRoutes({ limiters }));
  v1.use("/categories", categoryRoutes({ revalidate }));
  v1.use("/tags", tagRoutes({ revalidate }));
  v1.use("/authors", authorRoutes({ identity, revalidate }));
  v1.use("/pages", pageRoutes({ revalidate }));
  v1.use("/ads", adRoutes({ revalidate }));

  if (deps.prepare) app.use(deps.prepare);
  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
