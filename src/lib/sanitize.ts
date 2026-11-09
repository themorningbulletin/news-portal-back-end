import sanitizeHtml from "sanitize-html";

/**
 * Article bodies are produced by the CMS rich-text editor but are always
 * re-sanitized on the server: anything outside this allowlist is dropped, so
 * stored XSS is not possible even if a client bypasses the editor.
 */
export function sanitizeArticleHtml(dirty: string, allowedImageHosts: string[] = []): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "h2", "h3", "h4", "strong", "b", "em", "i", "s", "u", "a", "ul", "ol", "li",
      "blockquote", "hr", "br", "figure", "figcaption", "img", "code", "sub", "sup",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "width", "height"],
      // Paragraph alignment from the editor; only the text-align property survives (allowedStyles).
      p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"], blockquote: ["style"],
    },
    allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src ?? "";
      if (src.startsWith("/") && !src.startsWith("//")) return false;
      try {
        return !allowedImageHosts.includes(new URL(src).hostname);
      } catch {
        return true;
      }
    },
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href);
        const out: Record<string, string> = { href };
        if (external) out.rel = "noopener noreferrer";
        return { tagName, attribs: out };
      },
    },
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "iframe", "object", "embed"],
  }).trim();
}

/** Plain text fields: strip every tag and control character. */
export function sanitizePlain(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}
