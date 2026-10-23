/**
 * Registry of every Mongoose model, used for index sync, seeding and tests.
 * Feature code imports its own module's model directly.
 */
import { AdPlacement } from "../modules/ad/ad.model.js";
import { ArticleDailyStat, ReferrerDailyStat } from "../modules/analytics/analytics.model.js";
import { Article, ArticleRevision } from "../modules/article/article.model.js";
import { AuditLog } from "../modules/audit/audit.model.js";
import { Bookmark } from "../modules/bookmark/bookmark.model.js";
import { Category } from "../modules/category/category.model.js";
import { Media } from "../modules/media/media.model.js";
import { NewsletterSubscriber } from "../modules/newsletter/newsletter.model.js";
import { Page } from "../modules/page/page.model.js";
import { SiteSettings } from "../modules/settings/settings.model.js";
import { Tag } from "../modules/tag/tag.model.js";
import { UserProfile } from "../modules/user/user.model.js";

export {
  AdPlacement,
  Article,
  ArticleDailyStat,
  ArticleRevision,
  AuditLog,
  Bookmark,
  Category,
  Media,
  NewsletterSubscriber,
  Page,
  ReferrerDailyStat,
  SiteSettings,
  Tag,
  UserProfile,
};

export const allModels = [
  Category,
  Tag,
  UserProfile,
  Media,
  Article,
  ArticleRevision,
  AuditLog,
  Bookmark,
  NewsletterSubscriber,
  ArticleDailyStat,
  ReferrerDailyStat,
  SiteSettings,
  AdPlacement,
  Page,
];
