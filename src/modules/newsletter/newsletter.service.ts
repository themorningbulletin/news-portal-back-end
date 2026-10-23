import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { Mailer } from "../../lib/mailer.js";
import type { Locale } from "../../shared/constants.js";
import { NewsletterSubscriber } from "./newsletter.model.js";

/** Tokens are stored only as SHA-256 hashes. */
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
/** Do not resend a confirmation to the same address more often than this. */
const RESEND_INTERVAL_MS = 10 * 60 * 1000;

function confirmationEmail(locale: Locale, confirmUrl: string, unsubscribeUrl: string) {
  if (locale === "bn") {
    return {
      subject: "দ্য মর্নিং বুলেটিন নিউজলেটার: সাবস্ক্রিপশন নিশ্চিত করুন",
      text: `নিউজলেটারে সাবস্ক্রাইব করতে নিচের লিংকে গিয়ে নিশ্চিত করুন (৪৮ ঘণ্টা কার্যকর):\n${confirmUrl}\n\nআপনি অনুরোধ না করে থাকলে এই ইমেইল উপেক্ষা করুন; নিশ্চিত না করলে আপনাকে কোনো ইমেইল পাঠানো হবে না।\n\nযেকোনো সময় বাতিল: ${unsubscribeUrl}`,
    };
  }
  return {
    subject: "The Morning Bulletin newsletter: please confirm your subscription",
    text: `Confirm your subscription using the link below (valid for 48 hours):\n${confirmUrl}\n\nIf you did not ask for this, ignore this email; you will not be subscribed unless you confirm.\n\nUnsubscribe at any time: ${unsubscribeUrl}`,
  };
}

/**
 * Starts double opt-in. Callers always answer the same way, so the endpoint
 * cannot reveal who is subscribed.
 */
export async function subscribe(mailer: Mailer, email: string, locale: Locale): Promise<void> {
  const existing = await NewsletterSubscriber.findOne({ email });
  if (existing?.status === "active") return;
  if (existing?.confirmationSentAt && Date.now() - existing.confirmationSentAt.getTime() < RESEND_INTERVAL_MS) return;

  const confirmToken = newToken();
  const unsubscribeToken = newToken();
  await NewsletterSubscriber.updateOne(
    { email },
    {
      $set: {
        locale,
        status: "pending",
        confirmTokenHash: hash(confirmToken),
        confirmTokenExpiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
        unsubscribeTokenHash: hash(unsubscribeToken),
        confirmationSentAt: new Date(),
      },
      $setOnInsert: { email },
    },
    { upsert: true, runValidators: true },
  );

  const base = env().WEB_BASE_URL;
  const mail = confirmationEmail(
    locale,
    `${base}/${locale}/newsletter/confirm?token=${confirmToken}`,
    `${base}/${locale}/newsletter/unsubscribe?token=${unsubscribeToken}`,
  );
  try {
    await mailer.send({ to: email, ...mail });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "newsletter confirmation email failed");
  }
}

export async function confirm(token: string): Promise<void> {
  const sub = await NewsletterSubscriber.findOneAndUpdate(
    { confirmTokenHash: hash(token), status: "pending", confirmTokenExpiresAt: { $gt: new Date() } },
    { $set: { status: "active", confirmedAt: new Date(), confirmTokenHash: null, confirmTokenExpiresAt: null } },
    { returnDocument: "after" },
  );
  if (!sub) throw new AppError("not_found", "This confirmation link is invalid or has expired");
}

export async function unsubscribe(token: string): Promise<void> {
  const sub = await NewsletterSubscriber.findOneAndUpdate(
    { unsubscribeTokenHash: hash(token) },
    { $set: { status: "unsubscribed", unsubscribedAt: new Date(), confirmTokenHash: null } },
    { returnDocument: "after" },
  );
  if (!sub) throw new AppError("not_found", "This unsubscribe link is invalid");
}

export async function subscriberCounts() {
  const rows = await NewsletterSubscriber.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((n) => [n._id, n.count]));
}
