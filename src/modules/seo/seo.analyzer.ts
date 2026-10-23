import { countWords, htmlToText } from "../../lib/text.js";
import type { Locale } from "../../shared/constants.js";

/**
 * On-page SEO analysis for one story, similar in spirit to the checks of
 * editorial SEO plugins: snippet lengths, focus keyword placement, content
 * depth, images, links and structure. Pure function, so the same rules feed
 * the live editor panel and the site-wide SEO dashboard.
 */

export type CheckStatus = "good" | "warn" | "bad";
export interface SeoCheck {
  id: string;
  status: CheckStatus;
  /** Numbers shown next to the message, e.g. the measured length. */
  data?: Record<string, number | string>;
}
export interface SeoAnalysis {
  score: number;
  grade: "good" | "fair" | "poor";
  checks: SeoCheck[];
  snippet: { title: string; description: string; usesSummary: boolean };
}

export interface SeoInput {
  locale: Locale;
  title: string;
  slug: string;
  summary: string;
  body: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  focusKeyword?: string | null;
  hasImage: boolean;
  imageAlt?: string | null;
  tagCount: number;
  hasCategory: boolean;
  hasTranslation: boolean;
  ownUrl: string;
  siteHost: string;
}

export interface SeoContext {
  duplicateTitle?: boolean;
  duplicateDescription?: boolean;
}

/** Weights: some checks matter more than others for search visibility. */
const WEIGHTS: Record<string, number> = {
  title_length: 2,
  description: 2,
  focus_keyword: 1,
  keyword_in_title: 2,
  keyword_in_description: 1,
  keyword_in_slug: 1,
  keyword_in_intro: 1,
  keyword_density: 1,
  content_length: 2,
  image: 1,
  image_alt: 2,
  internal_links: 1,
  external_links: 0.5,
  subheadings: 0.5,
  tags: 1,
  category: 1,
  translation: 0.5,
  canonical: 1,
  slug_length: 0.5,
  duplicate_title: 2,
  duplicate_description: 1,
};

const norm = (s: string) => s.normalize("NFC").toLowerCase();

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export function analyzeSeo(input: SeoInput, ctx: SeoContext = {}): SeoAnalysis {
  const checks: SeoCheck[] = [];
  const add = (id: string, status: CheckStatus, data?: SeoCheck["data"]) => checks.push({ id, status, ...(data ? { data } : {}) });

  const snippetTitle = (input.seoTitle || input.title || "").trim();
  const usesSummary = !input.seoDescription;
  const snippetDescription = (input.seoDescription || input.summary || "").trim();
  const text = htmlToText(input.body);
  const words = countWords(text);
  const keyword = norm((input.focusKeyword ?? "").trim());

  // Search results show roughly 50–60 characters of a title.
  const tl = [...snippetTitle].length;
  add("title_length", tl >= 30 && tl <= 60 ? "good" : tl >= 15 && tl <= 70 ? "warn" : "bad", { length: tl });

  // A purpose-written meta description of ~70–160 characters.
  const dl = [...snippetDescription].length;
  add("description", dl === 0 ? "bad" : usesSummary || dl < 70 || dl > 160 ? "warn" : "good", { length: dl });

  if (!keyword) {
    add("focus_keyword", "warn");
  } else {
    add("focus_keyword", "good");
    add("keyword_in_title", norm(snippetTitle).includes(keyword) ? "good" : "bad");
    add("keyword_in_description", norm(snippetDescription).includes(keyword) ? "good" : "warn");
    const slugWords = norm(input.slug).replace(/-/g, " ");
    add("keyword_in_slug", slugWords.includes(keyword) ? "good" : "warn");
    const firstParagraph = norm(htmlToText((/<p[^>]*>([\s\S]*?)<\/p>/i.exec(input.body)?.[1] ?? "").trim()) || text.slice(0, 300));
    add("keyword_in_intro", firstParagraph.includes(keyword) ? "good" : "warn");
    const hits = countOccurrences(norm(text), keyword);
    const density = words ? (hits * Math.max(1, countWords(keyword)) * 100) / words : 0;
    const rounded = Math.round(density * 10) / 10;
    add("keyword_density", hits === 0 ? "bad" : density > 3 ? "warn" : density < 0.5 ? "warn" : "good", { density: rounded, count: hits });
  }

  // Thin pages rarely rank; news explainers benefit from depth.
  add("content_length", words >= 300 ? "good" : words >= 150 ? "warn" : "bad", { words });

  add("image", input.hasImage ? "good" : "warn");
  if (input.hasImage) add("image_alt", input.imageAlt ? "good" : "bad");

  let internal = 0;
  let external = 0;
  for (const m of input.body.matchAll(/href="([^"]+)"/g)) {
    const href = m[1] ?? "";
    if (href.startsWith("/") && !href.startsWith("//")) internal++;
    else {
      try {
        if (new URL(href).host === input.siteHost) internal++;
        else external++;
      } catch {
        // mailto: and malformed links are ignored.
      }
    }
  }
  add("internal_links", internal > 0 ? "good" : "warn", { count: internal });
  add("external_links", external > 0 ? "good" : "warn", { count: external });
  add("subheadings", words < 400 || /<h[23][\s>]/i.test(input.body) ? "good" : "warn");

  add("tags", input.tagCount > 0 ? "good" : "warn", { count: input.tagCount });
  add("category", input.hasCategory ? "good" : "bad");
  add("translation", input.hasTranslation ? "good" : "warn");
  add("canonical", !input.canonicalUrl || input.canonicalUrl === input.ownUrl ? "good" : "warn");
  const sl = [...input.slug].length;
  add("slug_length", sl <= 75 ? "good" : "warn", { length: sl });
  if (ctx.duplicateTitle !== undefined) add("duplicate_title", ctx.duplicateTitle ? "bad" : "good");
  if (ctx.duplicateDescription !== undefined) add("duplicate_description", ctx.duplicateDescription ? "warn" : "good");

  let total = 0;
  let earned = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.id] ?? 1;
    total += w;
    earned += c.status === "good" ? w : c.status === "warn" ? w / 2 : 0;
  }
  const score = total ? Math.round((earned / total) * 100) : 0;
  return {
    score,
    grade: score >= 80 ? "good" : score >= 50 ? "fair" : "poor",
    checks,
    snippet: { title: snippetTitle, description: snippetDescription, usesSummary },
  };
}
