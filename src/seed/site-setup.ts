/**
 * The publisher's section structure, information pages and homepage layout.
 * Applied with `npm run setup-site` (see src/scripts/setup-site.ts). Safe to run
 * more than once: it updates what exists and adds what is missing.
 */
import { Types } from "mongoose";
import { slugify } from "../lib/text.js";
import { Category } from "../modules/category/category.model.js";
import { Page } from "../modules/page/page.model.js";
import { SiteSettings, type HomepageBlockDoc } from "../modules/settings/settings.model.js";
import type { PageKey } from "../shared/constants.js";

type L = { bn: string; en: string };
interface SectionSpec {
  en: string;
  bn: string;
  /** Older English slugs this section replaces (renamed instead of duplicated). */
  was?: string[];
  children?: SectionSpec[];
}

export const SECTIONS: SectionSpec[] = [
  {
    en: "News",
    bn: "সংবাদ",
    children: [
      { en: "Bangladesh", bn: "বাংলাদেশ", was: ["national"] },
      { en: "Education", bn: "শিক্ষা" },
      { en: "Politics", bn: "রাজনীতি" },
      { en: "Health", bn: "স্বাস্থ্য" },
      { en: "Crime", bn: "অপরাধ" },
      { en: "Accidents & Fires", bn: "দুর্ঘটনা ও অগ্নিকাণ্ড" },
      { en: "Technology", bn: "প্রযুক্তি", was: ["science-tech"] },
    ],
  },
  {
    en: "World",
    bn: "বিশ্ব",
    was: ["worlds"],
    children: [
      { en: "Asia", bn: "এশিয়া" },
      { en: "Africa", bn: "আফ্রিকা" },
      { en: "Middle East", bn: "মধ্যপ্রাচ্য" },
      { en: "Europe", bn: "ইউরোপ" },
      { en: "America", bn: "আমেরিকা" },
    ],
  },
  {
    en: "Business",
    bn: "বাণিজ্য",
    children: [
      { en: "Economy", bn: "অর্থনীতি" },
      { en: "Agriculture", bn: "কৃষি" },
      { en: "Industry", bn: "শিল্প" },
      { en: "Corporate", bn: "করপোরেট" },
      { en: "Global Economy", bn: "বিশ্ব অর্থনীতি" },
    ],
  },
  {
    en: "The Climate News",
    bn: "জলবায়ু",
    children: [
      { en: "Climate Change", bn: "জলবায়ু পরিবর্তন" },
      { en: "Environment", bn: "পরিবেশ" },
      { en: "Biodiversity", bn: "জীববৈচিত্র্য" },
      { en: "Water & Fisheries", bn: "পানি ও মৎস্য" },
    ],
  },
  {
    en: "Sports",
    bn: "খেলা",
    children: [
      { en: "Cricket", bn: "ক্রিকেট" },
      { en: "Football", bn: "ফুটবল" },
      { en: "More Sports", bn: "অন্যান্য খেলা" },
    ],
  },
  {
    en: "Opinion",
    bn: "মতামত",
    children: [
      { en: "Editorial", bn: "সম্পাদকীয়" },
      { en: "Interview", bn: "সাক্ষাৎকার" },
    ],
  },
  {
    en: "Lifestyle",
    bn: "জীবনযাপন",
    children: [
      { en: "Fashion", bn: "ফ্যাশন" },
      { en: "Traveling", bn: "ভ্রমণ" },
      { en: "Health & Wellness", bn: "স্বাস্থ্য ও সুস্থতা" },
      { en: "Food & Recipe", bn: "খাবার ও রেসিপি" },
    ],
  },
  {
    en: "Youth",
    bn: "তারুণ্য",
    children: [
      { en: "Academic", bn: "একাডেমিক" },
      { en: "Campus", bn: "ক্যাম্পাস" },
      { en: "Career & Skill", bn: "ক্যারিয়ার ও দক্ষতা" },
    ],
  },
  {
    en: "Culture",
    bn: "সংস্কৃতি",
    children: [
      { en: "Religion", bn: "ধর্ম" },
      { en: "Entertainment", bn: "বিনোদন" },
      { en: "Books & Literature", bn: "বই ও সাহিত্য" },
      { en: "Heritage", bn: "ঐতিহ্য" },
    ],
  },
];

const slugOf = (name: string) => slugify(name.replace(/&/g, " "));

/** Upserts every section by its English web address (or one it replaces); returns ids by English slug. */
export async function applySections(opts: { deactivateOthers?: boolean } = {}) {
  const ids = new Map<string, Types.ObjectId>();
  const report = { created: [] as string[], updated: [] as string[], deactivated: [] as string[] };

  const upsert = async (spec: SectionSpec, order: number, parent: Types.ObjectId | null) => {
    const slug = { bn: slugOf(spec.bn), en: slugOf(spec.en) };
    const existing =
      (await Category.findOne({ "slug.en": slug.en })) ??
      (spec.was?.length ? await Category.findOne({ "slug.en": { $in: spec.was } }) : null) ??
      (await Category.findOne({ "slug.bn": slug.bn }));
    const fields = { name: { bn: spec.bn, en: spec.en }, slug, parent, order, isActive: true };
    if (existing) {
      // A section that is becoming a subsection must hand its own subsections back first.
      if (parent) await Category.updateMany({ parent: existing._id }, { $set: { parent: null } });
      existing.set(fields);
      await existing.save();
      report.updated.push(spec.en);
      ids.set(slug.en, existing._id);
    } else {
      const doc = await Category.create({ ...fields, description: {} });
      report.created.push(spec.en);
      ids.set(slug.en, doc._id);
    }
    return ids.get(slug.en)!;
  };

  let order = 1;
  for (const top of SECTIONS) {
    const id = await upsert(top, order++, null);
    let childOrder = 1;
    for (const child of top.children ?? []) await upsert(child, childOrder++, id);
  }
  // Re-run the parents so none was left pointing at a section that later became a subsection.
  for (const top of SECTIONS) {
    const id = ids.get(slugOf(top.en))!;
    for (const child of top.children ?? []) await Category.updateOne({ _id: ids.get(slugOf(child.en)) }, { $set: { parent: id } });
  }

  const known = [...ids.values()];
  const others = await Category.find({ _id: { $nin: known } }).select("name isActive");
  for (const o of others) {
    if (opts.deactivateOthers && o.isActive) {
      o.isActive = false;
      await o.save();
      report.deactivated.push(o.name.en);
    }
  }
  return { ids, report, others: others.map((o) => o.name.en) };
}

/* ------------------------------------------------------------------ */
/* Homepage layout (the publisher's sketch)                            */
/* ------------------------------------------------------------------ */

type Block = { section?: string; ad?: true; variant?: HomepageBlockDoc["variant"]; width: HomepageBlockDoc["width"]; count?: number };

/**
 * The publisher's sketch, row by row (rows add up to 12 columns). The first block,
 * Editor's Pick (lead story + three more) with Most read beside it, is built in.
 */
export const HOMEPAGE_LAYOUT: Block[] = [
  { ad: true, width: 12 },
  { section: "sports", variant: "feature", width: 9, count: 3 },
  { section: "entertainment", variant: "list", width: 3, count: 2 },
  { section: "opinion", variant: "side", width: 9, count: 3 },
  { section: "interview", variant: "list", width: 3, count: 2 },
  { ad: true, width: 12 },
  { section: "politics", variant: "feature", width: 8, count: 4 },
  { section: "health", variant: "grid", width: 4, count: 3 },
  { section: "world", variant: "side", width: 9, count: 3 },
  { section: "technology", variant: "list", width: 3, count: 2 },
  { ad: true, width: 12 },
  { section: "business", variant: "trio", width: 6, count: 4 },
  { section: "traveling", variant: "grid", width: 4, count: 2 },
  { ad: true, width: 2 },
  { section: "campus", variant: "mosaic", width: 3, count: 2 },
  { section: "career-skill", variant: "mosaic", width: 3, count: 2 },
  { section: "lifestyle", variant: "list", width: 3, count: 3 },
  { section: "religion", variant: "list", width: 3, count: 3 },
  { ad: true, width: 12 },
];

export async function applyHomepageLayout(ids: Map<string, Types.ObjectId>, opts: { force?: boolean } = {}) {
  const current = await SiteSettings.findOne({ key: "site" }).select("homepageSections").lean();
  if (current?.homepageSections?.length && !opts.force) return { applied: false };
  const blocks: HomepageBlockDoc[] = HOMEPAGE_LAYOUT.flatMap((b): HomepageBlockDoc[] => {
    if (b.ad) return [{ kind: "ad" as const, category: null, variant: "grid" as const, width: b.width, count: null }];
    const id = ids.get(b.section!);
    return id ? [{ kind: "section" as const, category: id, variant: b.variant!, width: b.width, count: b.count ?? null }] : [];
  });
  await SiteSettings.updateOne({ key: "site" }, { $set: { homepageSections: blocks }, $setOnInsert: { key: "site" } }, { upsert: true });
  return { applied: true };
}

/* ------------------------------------------------------------------ */
/* Information pages                                                   */
/* ------------------------------------------------------------------ */

export interface Contact {
  email?: string;
  phone?: string;
  address?: L;
}

const p = (...lines: string[]) => lines.map((l) => (l.startsWith("<") ? l : `<p>${l}</p>`)).join("\n");

function pages(contact: Contact): Record<PageKey, { title: L; body: L; needsContact?: boolean }> {
  const email = contact.email ? `<a href="mailto:${contact.email}">${contact.email}</a>` : "";
  const contactLines = (l: "bn" | "en") =>
    [
      contact.email ? `<li>${l === "bn" ? "ইমেইল" : "Email"}: ${email}</li>` : "",
      contact.phone ? `<li>${l === "bn" ? "ফোন" : "Phone"}: ${contact.phone}</li>` : "",
      contact.address?.[l] ? `<li>${l === "bn" ? "ঠিকানা" : "Address"}: ${contact.address[l]}</li>` : "",
    ].join("");

  return {
    about: {
      title: { bn: "আমাদের সম্পর্কে", en: "About us" },
      body: {
        bn: p(
          "দ্য মর্নিং বুলেটিন একটি দ্বিভাষিক (বাংলা ও ইংরেজি) অনলাইন সংবাদমাধ্যম। দেশ ও বিশ্বের গুরুত্বপূর্ণ খবর যাচাই করে, সহজ ভাষায় এবং দ্রুত পাঠকের কাছে পৌঁছে দেওয়াই আমাদের লক্ষ্য।",
          "<h2>আমরা যা করি</h2>",
          "রাজনীতি, অর্থনীতি, শিক্ষা, স্বাস্থ্য, জলবায়ু, খেলা, সংস্কৃতি ও তারুণ্য: প্রতিটি বিষয়ে আমরা খবর, বিশ্লেষণ, ব্যাখ্যা ও মতামত প্রকাশ করি। প্রতিটি প্রতিবেদন প্রকাশের আগে সম্পাদকীয় পর্যালোচনার মধ্য দিয়ে যায়।",
          "<h2>আমাদের অঙ্গীকার</h2>",
          "<ul><li>তথ্য যাচাই ছাড়া কোনো খবর প্রকাশ নয়।</li><li>ভুল হলে তা খোলাখুলি স্বীকার ও সংশোধন।</li><li>বিজ্ঞাপন ও সংবাদ সবসময় আলাদা রাখা।</li><li>পাঠকের গোপনীয়তার প্রতি সম্মান।</li></ul>",
          "আমাদের কাজের নীতিমালা জানতে <a href=\"/bn/info/editorial-policy\">সম্পাদকীয় নীতি</a> দেখুন। কোনো মতামত বা তথ্য জানাতে <a href=\"/bn/info/contact\">যোগাযোগ</a> পাতায় যান।",
        ),
        en: p(
          "The Morning Bulletin is a bilingual (Bangla and English) online news publication. Our aim is to bring readers the important news from Bangladesh and the world quickly, clearly and verified.",
          "<h2>What we do</h2>",
          "We publish news, analysis, explainers and opinion across politics, the economy, education, health, climate, sport, culture and youth. Every story goes through editorial review before it is published.",
          "<h2>Our commitments</h2>",
          "<ul><li>Nothing is published without verification.</li><li>Mistakes are acknowledged and corrected openly.</li><li>Advertising is always kept separate from journalism.</li><li>We respect our readers' privacy.</li></ul>",
          "Read our <a href=\"/en/info/editorial-policy\">editorial policy</a> to see how we work, or visit the <a href=\"/en/info/contact\">contact</a> page to reach us.",
        ),
      },
    },
    contact: {
      needsContact: true,
      title: { bn: "যোগাযোগ", en: "Contact us" },
      body: {
        bn: p(
          "খবরের তথ্য, সংশোধনের অনুরোধ, মতামত বা যেকোনো প্রয়োজনে আমাদের সঙ্গে যোগাযোগ করুন।",
          `<ul>${contactLines("bn")}</ul>`,
          "সংবাদের তথ্য পাঠালে সম্ভব হলে প্রমাণ বা সূত্র যুক্ত করুন। আপনার পরিচয় গোপন রাখতে চাইলে তা উল্লেখ করুন; আমরা সূত্রের গোপনীয়তা রক্ষা করি।",
          "কোনো প্রতিবেদনে ভুল চোখে পড়লে প্রতিবেদনের লিংকসহ জানান। আমাদের <a href=\"/bn/info/corrections\">সংশোধন নীতি</a> অনুযায়ী দ্রুত ব্যবস্থা নেওয়া হবে।",
        ),
        en: p(
          "Get in touch with news tips, correction requests, feedback or any other enquiry.",
          `<ul>${contactLines("en")}</ul>`,
          "When sending a tip, please include evidence or sources if you can. Tell us if you wish to stay anonymous; we protect our sources.",
          "If you spot an error in a story, send us its link. We act on it promptly under our <a href=\"/en/info/corrections\">corrections policy</a>.",
        ),
      },
    },
    "editorial-policy": {
      title: { bn: "সম্পাদকীয় নীতি", en: "Editorial policy" },
      body: {
        bn: p(
          "<h2>নির্ভুলতা</h2>",
          "প্রতিটি তথ্য প্রকাশের আগে যাচাই করা হয়। গুরুত্বপূর্ণ দাবির জন্য একাধিক নির্ভরযোগ্য সূত্রের ওপর নির্ভর করা হয়। যা যাচাই করা যায়নি, তা স্পষ্টভাবে উল্লেখ করা হয়।",
          "<h2>নিরপেক্ষতা ও ভারসাম্য</h2>",
          "বিতর্কিত বিষয়ে সংশ্লিষ্ট সব পক্ষের বক্তব্য নেওয়ার চেষ্টা করা হয়। খবর ও মতামত আলাদা রাখা হয়; মতামত লেখা সবসময় 'মতামত' হিসেবে চিহ্নিত থাকে।",
          "<h2>সূত্র</h2>",
          "যেখানে সম্ভব সূত্রের নাম উল্লেখ করা হয়। নাম প্রকাশে ঝুঁকি থাকলে সম্পাদকের অনুমোদন সাপেক্ষে বেনামি সূত্র ব্যবহার করা হয়।",
          "<h2>স্বার্থের সংঘাত</h2>",
          "প্রতিবেদক বা সম্পাদকের ব্যক্তিগত স্বার্থ জড়িত থাকলে তিনি সেই প্রতিবেদন থেকে বিরত থাকেন। বিজ্ঞাপনদাতারা আমাদের সংবাদ সিদ্ধান্তে প্রভাব ফেলতে পারেন না।",
          "<h2>ছবি ও ভিডিও</h2>",
          "ছবি বা ভিডিও এমনভাবে সম্পাদনা করা হয় না, যাতে তার অর্থ বদলে যায়। প্রতিটি ছবির সূত্র (ক্রেডিট) উল্লেখ করা হয়।",
          "<h2>সংশোধন</h2>",
          "ভুল ধরা পড়লে <a href=\"/bn/info/corrections\">সংশোধন নীতি</a> অনুযায়ী দ্রুত তা ঠিক করা হয় এবং প্রতিবেদনে জানানো হয়।",
        ),
        en: p(
          "<h2>Accuracy</h2>",
          "Every fact is checked before publication. Important claims rely on more than one reliable source. Anything we could not verify is clearly stated as such.",
          "<h2>Fairness and balance</h2>",
          "On contested issues we seek the views of everyone involved. News and opinion are kept apart; opinion pieces are always labelled as opinion.",
          "<h2>Sources</h2>",
          "We name our sources wherever possible. Anonymous sources are used only with an editor's approval, when naming them would put them at risk.",
          "<h2>Conflicts of interest</h2>",
          "Reporters and editors step away from stories in which they have a personal interest. Advertisers have no influence over our editorial decisions.",
          "<h2>Photos and video</h2>",
          "Images are never edited in a way that changes their meaning. Every image carries a credit.",
          "<h2>Corrections</h2>",
          "Errors are fixed promptly and noted on the story, as set out in our <a href=\"/en/info/corrections\">corrections policy</a>.",
        ),
      },
    },
    corrections: {
      title: { bn: "সংশোধন নীতি", en: "Corrections policy" },
      body: {
        bn: p(
          "ভুল হতেই পারে; গুরুত্বপূর্ণ হলো তা দ্রুত ও খোলাখুলিভাবে সংশোধন করা।",
          "<h2>কীভাবে জানাবেন</h2>",
          "কোনো প্রতিবেদনে ভুল দেখলে প্রতিবেদনের লিংক ও কী ভুল তা <a href=\"/bn/info/contact\">যোগাযোগ</a> পাতার ঠিকানায় জানান।",
          "<h2>আমরা যা করি</h2>",
          "<ul><li>তথ্যগত ভুল সংশোধন করে প্রতিবেদনে 'হালনাগাদ' সময়সহ উল্লেখ করা হয়।</li><li>বানান বা ছোটখাটো ভাষাগত ভুল নীরবে ঠিক করা হয়।</li><li>গুরুতর ভুলের ক্ষেত্রে প্রতিবেদনের শেষে কী বদলানো হয়েছে, তা ব্যাখ্যা করা হয়।</li><li>কোনো প্রতিবেদন পুরোপুরি ভিত্তিহীন প্রমাণিত হলে তা সরিয়ে কারণ জানানো হয়।</li></ul>",
        ),
        en: p(
          "Mistakes happen; what matters is correcting them quickly and openly.",
          "<h2>How to tell us</h2>",
          "If you see an error, send the story's link and what is wrong to the address on our <a href=\"/en/info/contact\">contact</a> page.",
          "<h2>What we do</h2>",
          "<ul><li>Factual errors are corrected and the story shows when it was updated.</li><li>Spelling and minor language slips are fixed without a note.</li><li>For serious errors we explain at the end of the story what was changed.</li><li>A story shown to be wholly unfounded is removed and the reason is published.</li></ul>",
        ),
      },
    },
    privacy: {
      title: { bn: "গোপনীয়তা নীতি", en: "Privacy policy" },
      body: {
        bn: p(
          "আপনার ব্যক্তিগত তথ্যের সুরক্ষা আমাদের কাছে গুরুত্বপূর্ণ। এই নীতিতে জানানো হলো আমরা কী তথ্য রাখি এবং কেন।",
          "<h2>অ্যাকাউন্ট</h2>",
          "অ্যাকাউন্ট খুললে আপনার ইমেইল ঠিকানা ও নাম রাখা হয় (সাইন-ইন সেবা Google Firebase-এর মাধ্যমে)। সংরক্ষিত খবর, অনুসরণ করা বিভাগ ও পড়ার পছন্দ আপনার অ্যাকাউন্টে থাকে। অ্যাকাউন্ট পাতা থেকে যেকোনো সময় অ্যাকাউন্ট মুছে ফেলা যায়।",
          "<h2>নিউজলেটার</h2>",
          "নিউজলেটারে সাবস্ক্রাইব করলে শুধু আপনার ইমেইল ঠিকানা রাখা হয়। প্রতিটি ইমেইলের লিংক থেকে যেকোনো সময় সাবস্ক্রিপশন বাতিল করা যায়।",
          "<h2>পাঠের পরিসংখ্যান</h2>",
          "কোন খবর কতবার পড়া হয়েছে, তা আমরা মোট সংখ্যা হিসেবে গুনি। এতে আপনার পরিচয়, আইপি ঠিকানা বা ব্যক্তিগত তথ্য রাখা হয় না।",
          "<h2>কুকি ও বিজ্ঞাপন</h2>",
          "সাইন-ইন রাখতে প্রয়োজনীয় কুকি ব্যবহার করা হয়। বিজ্ঞাপন দেখানো হলে Google AdSense কুকি ব্যবহার করতে পারে; ব্যক্তিগতকৃত বিজ্ঞাপনের আগে আপনার সম্মতি নেওয়া হয়, এবং ফুটারের লিংক থেকে তা বদলানো যায়।",
          "<h2>তথ্য বিক্রি নয়</h2>",
          "আমরা আপনার ব্যক্তিগত তথ্য কারও কাছে বিক্রি করি না।",
          "এই নীতি নিয়ে প্রশ্ন থাকলে <a href=\"/bn/info/contact\">যোগাযোগ</a> করুন।",
        ),
        en: p(
          "Protecting your personal information matters to us. This policy explains what we keep and why.",
          "<h2>Accounts</h2>",
          "If you create an account we keep your email address and name (sign-in is provided by Google Firebase). Saved stories, followed sections and reading preferences are stored with your account. You can delete your account at any time from the account page.",
          "<h2>Newsletter</h2>",
          "If you subscribe to the newsletter we keep only your email address. Every email has a link to unsubscribe at any time.",
          "<h2>Reading statistics</h2>",
          "We count how often each story is read, as totals only. We do not store your identity, IP address or other personal details for this.",
          "<h2>Cookies and advertising</h2>",
          "We use the cookies needed to keep you signed in. When ads are shown, Google AdSense may use cookies; we ask for your consent before personalised ads, and you can change it from the link in the footer.",
          "<h2>We do not sell data</h2>",
          "We never sell your personal information.",
          "Questions about this policy? <a href=\"/en/info/contact\">Contact us</a>.",
        ),
      },
    },
    terms: {
      title: { bn: "ব্যবহারের শর্তাবলি", en: "Terms of use" },
      body: {
        bn: p(
          "এই সাইট ব্যবহার করলে আপনি নিচের শর্তগুলো মেনে নিচ্ছেন।",
          "<h2>কনটেন্টের মালিকানা</h2>",
          "এই সাইটের লেখা, ছবি ও ভিডিওর স্বত্ব দ্য মর্নিং বুলেটিন বা সংশ্লিষ্ট স্বত্বাধিকারীর। অনুমতি ছাড়া পুরো প্রতিবেদন পুনঃপ্রকাশ করা যাবে না। সূত্র ও লিংক উল্লেখ করে সংক্ষিপ্ত অংশ উদ্ধৃত করা যাবে।",
          "<h2>অ্যাকাউন্ট</h2>",
          "আপনার অ্যাকাউন্টের নিরাপত্তার দায়িত্ব আপনার। অপব্যবহার, স্প্যাম বা আইনবিরোধী কাজে ব্যবহৃত অ্যাকাউন্ট বন্ধ করা হতে পারে।",
          "<h2>বাইরের লিংক</h2>",
          "প্রতিবেদনে অন্য সাইটের লিংক থাকতে পারে; সেসব সাইটের কনটেন্টের দায় আমাদের নয়।",
          "<h2>পরিবর্তন</h2>",
          "এই শর্তাবলি সময়ে সময়ে হালনাগাদ হতে পারে। পরিবর্তনের তারিখ এই পাতায় দেখানো হয়।",
        ),
        en: p(
          "By using this site you agree to the following terms.",
          "<h2>Ownership of content</h2>",
          "The text, photos and video on this site belong to The Morning Bulletin or their respective owners. Full stories may not be republished without permission. Short extracts may be quoted with credit and a link.",
          "<h2>Accounts</h2>",
          "You are responsible for keeping your account secure. Accounts used for abuse, spam or unlawful activity may be closed.",
          "<h2>External links</h2>",
          "Stories may link to other sites; we are not responsible for their content.",
          "<h2>Changes</h2>",
          "These terms may be updated from time to time. The date of the last change is shown on this page.",
        ),
      },
    },
    advertise: {
      needsContact: true,
      title: { bn: "বিজ্ঞাপন দিন", en: "Advertise with us" },
      body: {
        bn: p(
          "দ্য মর্নিং বুলেটিনে বিজ্ঞাপন দিয়ে বাংলা ও ইংরেজি দুই ভাষার পাঠকের কাছে পৌঁছান।",
          "<h2>বিজ্ঞাপনের স্থান</h2>",
          "<ul><li>হেডার ও ফুটার ব্যানার</li><li>প্রচ্ছদের বিভাগগুলোর মাঝে</li><li>প্রতিবেদনের ভেতরে ও পাশের কলামে</li><li>বিভাগ ও তালিকা পাতায়</li></ul>",
          "সব বিজ্ঞাপন 'বিজ্ঞাপন' লেখা দিয়ে স্পষ্টভাবে চিহ্নিত থাকে এবং সংবাদ থেকে আলাদা রাখা হয়।",
          "<h2>যোগাযোগ</h2>",
          `<ul>${contactLines("bn")}</ul>`,
        ),
        en: p(
          "Reach readers in both Bangla and English by advertising with The Morning Bulletin.",
          "<h2>Placements</h2>",
          "<ul><li>Header and footer banners</li><li>Between sections on the front page</li><li>Inside stories and in the side column</li><li>On section and list pages</li></ul>",
          "Every advertisement is clearly labelled as such and kept separate from the news.",
          "<h2>Contact</h2>",
          `<ul>${contactLines("en")}</ul>`,
        ),
      },
    },
  };
}

/**
 * Adds any information page that does not exist yet (never overwrites one an editor wrote).
 * Pages that need contact details are left as drafts until an email or phone is given.
 */
export async function applyPages(contact: Contact, updatedBy?: Types.ObjectId) {
  const hasContact = Boolean(contact.email || contact.phone);
  const report = { published: [] as string[], drafts: [] as string[], kept: [] as string[] };
  for (const [key, page] of Object.entries(pages(contact)) as [PageKey, ReturnType<typeof pages>[PageKey]][]) {
    for (const locale of ["bn", "en"] as const) {
      if (await Page.exists({ key, locale })) {
        report.kept.push(`${key}/${locale}`);
        continue;
      }
      const status = page.needsContact && !hasContact ? "draft" : "published";
      await Page.create({ key, locale, title: page.title[locale], body: page.body[locale], status, updatedBy });
      (status === "published" ? report.published : report.drafts).push(`${key}/${locale}`);
    }
  }
  return report;
}
