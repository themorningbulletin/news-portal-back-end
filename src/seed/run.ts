import { Types } from "mongoose";
import { logger } from "../lib/logger.js";
import { slugify } from "../lib/text.js";
import { AdPlacement } from "../modules/ad/ad.model.js";
import { Article } from "../modules/article/article.model.js";
import { Category } from "../modules/category/category.model.js";
import { Media } from "../modules/media/media.model.js";
import { SiteSettings } from "../modules/settings/settings.model.js";
import { Tag } from "../modules/tag/tag.model.js";
import { UserProfile } from "../modules/user/user.model.js";
import { AD_PLACEMENT_KEYS, type Locale } from "../shared/constants.js";
import { allModels } from "../shared/models.js";
import { prepareContent } from "../modules/article/article.editorial.js";
import { authors, categories, images, stories, tags } from "./content.js";

const IMAGE_CREDIT = "The Morning Bulletin illustration";

export async function seedDatabase(opts: { reset?: boolean; now?: Date } = {}): Promise<{ seeded: boolean }> {
  if (opts.reset) {
    for (const model of allModels) await model.collection.deleteMany({});
  } else if (await Article.exists({})) {
    logger.info("database already has stories; seed skipped (use --reset to replace)");
    return { seeded: false };
  }
  const now = opts.now ?? new Date();

  const catIds = new Map<string, Types.ObjectId>();
  for (const c of categories.filter((x) => !x.parent)) {
    const doc = await Category.create({ ...c, slug: { bn: slugify(c.slug.bn), en: slugify(c.slug.en) }, parent: null });
    catIds.set(c.key, doc._id);
  }
  for (const c of categories.filter((x) => x.parent)) {
    const doc = await Category.create({ ...c, slug: { bn: slugify(c.slug.bn), en: slugify(c.slug.en) }, parent: catIds.get(c.parent!) });
    catIds.set(c.key, doc._id);
  }

  const tagIds = new Map<string, Types.ObjectId>();
  for (const [key, name] of Object.entries(tags)) {
    const doc = await Tag.create({ name, slug: { bn: slugify(name.bn), en: slugify(name.en) } });
    tagIds.set(key, doc._id);
  }

  const authorIds = new Map<string, Types.ObjectId>();
  for (const a of authors) {
    // Seed bylines cannot sign in: their uid does not exist in Firebase.
    const doc = await UserProfile.create({
      firebaseUid: `seed:${a.key}`,
      displayName: a.name.en,
      role: "author",
      author: { isPublic: true, slug: a.slug, name: a.name, bio: a.bio },
    });
    authorIds.set(a.key, doc._id);
  }

  const imageIds = new Map<string, Types.ObjectId>();
  for (const img of images) {
    const doc = await Media.create({
      provider: "static",
      publicId: `seed/${img.file}`,
      url: `/seed/${img.file}`,
      width: 1600,
      height: 900,
      format: "svg",
      bytes: 0,
      alt: img.alt,
      credit: IMAGE_CREDIT,
    });
    imageIds.set(img.key, doc._id);
  }

  for (const s of stories) {
    const group = new Types.ObjectId();
    const publishedAt = new Date(now.getTime() - s.ageHours * 3_600_000);
    const author = authorIds.get(s.author)!;
    for (const locale of ["bn", "en"] as Locale[]) {
      const content = s[locale];
      await Article.create({
        ...prepareContent({ title: content.title, summary: content.summary, body: content.body }, locale),
        locale,
        translationGroup: group,
        slug: slugify(content.slug),
        status: "published",
        format: s.format,
        category: catIds.get(s.category),
        tags: s.tags.map((t) => tagIds.get(t)!),
        authors: [author],
        createdBy: author,
        featuredImage: s.image ? imageIds.get(s.image) : null,
        seo: { description: content.summary.slice(0, 300) },
        isFeatured: Boolean(s.featured),
        isEditorsPick: Boolean(s.editorsPick),
        publishedAt,
        firstPublishedAt: publishedAt,
      });
    }
  }

  await SiteSettings.create({
    key: "site",
    homepageSections: ["national", "economy", "science", "health", "sports"].map((k, i) => ({
      category: catIds.get(k)!,
      variant: i % 2 === 0 ? "feature" : "grid",
    })),
  });
  for (const key of AD_PLACEMENT_KEYS) await AdPlacement.create({ key, enabled: false });

  logger.info({ stories: stories.length * 2, categories: categories.length }, "demo content seeded");
  return { seeded: true };
}
