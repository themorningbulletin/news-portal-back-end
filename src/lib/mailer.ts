import nodemailer, { type Transporter } from "nodemailer";
import { env, features } from "../config/env.js";
import { logger } from "./logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  /** True when messages are really delivered (or, outside production, logged for local testing). */
  available(): boolean;
  send(message: MailMessage): Promise<void>;
}

let transport: Transporter | undefined;

export const smtpMailer: Mailer = {
  available: () => features.email() || env().NODE_ENV !== "production",
  async send(message) {
    const e = env();
    if (!features.email(e)) {
      if (e.NODE_ENV === "production") throw new Error("Email delivery is not configured");
      // Local development only: show the message instead of sending it.
      logger.info({ to: message.to, subject: message.subject, text: message.text }, "email (not sent: SMTP not configured)");
      return;
    }
    transport ??= nodemailer.createTransport(e.SMTP_URL!);
    await transport.sendMail({ from: e.MAIL_FROM, ...message });
  },
};
