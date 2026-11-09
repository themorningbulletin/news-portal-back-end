/**
 * Applies the publisher's section structure, information pages and homepage layout
 * to the database in MONGODB_URI. Safe to run more than once.
 *
 *   npm run setup-site -- --email news@example.com --phone "+880 1XXX-XXXXXX"
 *
 * Options:
 *   --email, --phone          contact details for the Contact and Advertise pages
 *                             (without either, those two pages are added as drafts)
 *   --address-bn, --address-en   postal address in each language
 *   --layout                  replace the homepage layout even if one is already saved
 *   --deactivate-others       hide sections that are not in the publisher's list
 *   --dry-run                 only print what exists; change nothing
 */
import { parseArgs } from "node:util";
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../lib/db.js";
import { syncAllIndexes } from "../lib/indexes.js";
import { Category } from "../modules/category/category.model.js";
import { applyHomepageLayout, applyPages, applySections } from "../seed/site-setup.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    phone: { type: "string" },
    "address-bn": { type: "string" },
    "address-en": { type: "string" },
    layout: { type: "boolean", default: false },
    "deactivate-others": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const e = env();
if (!e.MONGODB_URI) throw new Error("MONGODB_URI is not set");
if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw new Error("--email is not a valid address");

await connectDb(e.MONGODB_URI);
try {
  if (values["dry-run"]) {
    const cats = await Category.find().select("name slug parent isActive").lean();
    console.log(`${cats.length} sections in the database:`);
    for (const c of cats) console.log(`  ${c.isActive ? " " : "x"} ${c.parent ? "  └ " : ""}${c.name.en} (/${c.slug.en})`);
  } else {
    await syncAllIndexes();
    const sections = await applySections({ deactivateOthers: values["deactivate-others"] });
    console.log(`Sections: ${sections.report.created.length} added, ${sections.report.updated.length} updated.`);
    if (sections.report.deactivated.length) console.log(`  Hidden: ${sections.report.deactivated.join(", ")}`);
    else if (sections.others.length) console.log(`  Not in the list (left as they are): ${sections.others.join(", ")}. Use --deactivate-others to hide them.`);

    const layout = await applyHomepageLayout(sections.ids, { force: values.layout });
    console.log(layout.applied ? "Homepage layout: applied." : "Homepage layout: one is already saved, left unchanged (use --layout to replace it).");

    const address = values["address-bn"] || values["address-en"] ? { bn: values["address-bn"] ?? "", en: values["address-en"] ?? "" } : undefined;
    const pages = await applyPages({ email: values.email, phone: values.phone, address });
    console.log(`Pages: ${pages.published.length} published, ${pages.drafts.length} drafts, ${pages.kept.length} already existed (not changed).`);
    if (pages.drafts.length) console.log(`  Drafts (need --email or --phone, or finish them in the newsroom): ${pages.drafts.join(", ")}`);
    console.log("Done. The site refreshes its cached menus and homepage within a few minutes, or right away after the next save in the newsroom.");
  }
} finally {
  await disconnectDb();
}
