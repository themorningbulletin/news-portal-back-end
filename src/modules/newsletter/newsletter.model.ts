import { Schema, model, type Types } from "mongoose";
import {
  LOCALES,
  type Locale,
} from "../../shared/constants.js";

export interface NewsletterSubscriberDoc {
  _id: Types.ObjectId;
  email: string;
  locale: Locale;
  status: "pending" | "active" | "unsubscribed";
  confirmTokenHash?: string | null;
  confirmTokenExpiresAt?: Date | null;
  unsubscribeTokenHash: string;
  confirmationSentAt?: Date | null;
  confirmedAt?: Date | null;
  unsubscribedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const newsletterSchema = new Schema<NewsletterSubscriberDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    locale: { type: String, enum: LOCALES, required: true },
    status: { type: String, enum: ["pending", "active", "unsubscribed"], default: "pending" },
    confirmTokenHash: { type: String, default: null },
    confirmTokenExpiresAt: { type: Date, default: null },
    unsubscribeTokenHash: { type: String, required: true },
    confirmationSentAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
newsletterSchema.index({ email: 1 }, { unique: true });
newsletterSchema.index({ confirmTokenHash: 1 }, { sparse: true });
newsletterSchema.index({ unsubscribeTokenHash: 1 });

export const NewsletterSubscriber = model<NewsletterSubscriberDoc>("NewsletterSubscriber", newsletterSchema);
