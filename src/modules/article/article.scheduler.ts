import { logger } from "../../lib/logger.js";
import { Article } from "./article.model.js";
import { AuditLog } from "../audit/audit.model.js";
import { revalidationTags } from "./article.editorial.js";
import { type Revalidator } from "../../lib/revalidate.js";

/**
 * Publishes scheduled stories when their time comes and refreshes caches
 * when breaking banners or pinned leads expire. Each article is claimed with
 * an atomic update, so running several API instances cannot publish twice.
 */
export async function schedulerTick(revalidate: Revalidator, since: Date, now = new Date()): Promise<number> {
  let published = 0;
  for (;;) {
    const doc = await Article.findOneAndUpdate(
      { status: "scheduled", scheduledFor: { $lte: now } },
      [
        {
          $set: {
            status: "published",
            publishedAt: { $ifNull: ["$firstPublishedAt", "$scheduledFor"] },
            firstPublishedAt: { $ifNull: ["$firstPublishedAt", "$scheduledFor"] },
            scheduledFor: null,
            version: { $add: ["$version", 1] },
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true },
    );
    if (!doc) break;
    published++;
    await AuditLog.create({
      actor: null,
      action: "article.publish_scheduled",
      entityType: "article",
      entityId: String(doc._id),
      summary: doc.title.slice(0, 300),
    });
    await revalidate(revalidationTags(doc));
  }

  const expired = await Article.exists({
    status: "published",
    $or: [{ breakingUntil: { $gt: since, $lte: now } }, { pinnedUntil: { $gt: since, $lte: now } }],
  });
  if (expired) await revalidate(["articles"]);
  return published;
}

export function startScheduler(revalidate: Revalidator, intervalMs: number): () => void {
  let last = new Date();
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    const now = new Date();
    try {
      const n = await schedulerTick(revalidate, last, now);
      if (n) logger.info({ published: n }, "scheduled stories published");
      last = now;
    } catch (err) {
      logger.error({ err }, "scheduler tick failed");
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
