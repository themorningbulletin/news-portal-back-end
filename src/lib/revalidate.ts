import { env } from "../config/env.js";
import { logger } from "./logger.js";

export type Revalidator = (tags: string[]) => Promise<void>;

/**
 * Tells the Next.js frontend which cache tags are stale after a publishing
 * event. Tag scheme (kept in sync with front-end/lib/api.ts):
 *   articles                   every article list (home, latest, sections, sitemaps)
 *   article:<locale>:<slug>    one article page (current and previous slugs)
 *   article-group:<id>         translation links for a story
 *   taxonomy, authors, settings, ads, pages
 */
export const webhookRevalidator: Revalidator = async (tags) => {
  const { WEB_REVALIDATE_URL, REVALIDATE_SECRET } = env();
  const unique = [...new Set(tags)].filter((t) => t.length <= 256);
  if (!WEB_REVALIDATE_URL || !REVALIDATE_SECRET || unique.length === 0) return;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(WEB_REVALIDATE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-revalidate-secret": REVALIDATE_SECRET },
        body: JSON.stringify({ tags: unique }),
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return;
      logger.warn({ status: res.status, attempt }, "revalidation webhook rejected");
    } catch (err) {
      logger.warn({ err: (err as Error).message, attempt }, "revalidation webhook failed");
    }
    await new Promise((r) => setTimeout(r, attempt * 500));
  }
  logger.error({ tags: unique }, "revalidation webhook gave up; pages refresh when their cache lifetime ends");
};

export const noopRevalidator: Revalidator = async () => {};
