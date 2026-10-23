/**
 * OpenAPI 3.1 description of /api/v1, served at /api/v1/openapi.json.
 * Request bodies are validated by the Zod schemas in src/routes; this
 * document describes them for humans and client generators.
 */

type Op = {
  summary: string;
  tags: string[];
  auth?: "session" | "staff" | "csrf";
  params?: { name: string; in: "query" | "path"; required?: boolean; schema?: Record<string, unknown>; description?: string }[];
  body?: Record<string, unknown>;
  responses?: Record<string, string>;
};

const locale = { name: "locale", in: "query" as const, required: true, schema: { type: "string", enum: ["bn", "en"] } };
const page = { name: "page", in: "query" as const, schema: { type: "integer", minimum: 1, default: 1 } };
const limit = { name: "limit", in: "query" as const, schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } };
const id = (name = "id") => ({ name, in: "path" as const, required: true, schema: { type: "string", pattern: "^[a-f0-9]{24}$" } });
const slug = { name: "slug", in: "path" as const, required: true, schema: { type: "string" } };

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = { type: "string" };
const bool = { type: "boolean" };
const int = { type: "integer" };
const localized = obj({ bn: str, en: str });

const articleFields = {
  title: str,
  slug: str,
  summary: str,
  body: { type: "string", description: "HTML; sanitized on the server against a strict allowlist" },
  format: { type: "string", enum: ["standard", "explainer", "opinion", "photo", "video"] },
  category: { type: ["string", "null"] },
  tags: { type: "array", items: str },
  authors: { type: "array", items: str },
  featuredImage: { type: ["string", "null"] },
  imageAlt: str,
  imageCaption: str,
  imageCredit: str,
  videoUrl: { type: "string", description: "YouTube or Vimeo https URL, or empty" },
  seo: obj({ title: str, description: str, canonicalUrl: str, socialImage: { type: ["string", "null"] } }),
  isFeatured: bool,
  isEditorsPick: bool,
  pinnedUntil: { type: ["string", "null"], format: "date-time" },
  breakingUntil: { type: ["string", "null"], format: "date-time" },
};

const ops: Record<string, Record<string, Op>> = {
  "/health": { get: { summary: "Liveness probe", tags: ["Health"] } },
  "/ready": { get: { summary: "Readiness probe (database ping)", tags: ["Health"], responses: { "503": "Database unavailable" } } },
  "/config": { get: { summary: "Public feature flags", tags: ["Public"] } },
  "/homepage": { get: { summary: "Homepage modules for a locale", tags: ["Public"], params: [locale] } },
  "/articles": {
    get: {
      summary: "Published stories, newest first",
      tags: ["Public"],
      params: [
        locale,
        page,
        limit,
        { name: "category", in: "query", schema: str, description: "category slug (includes subsections)" },
        { name: "tag", in: "query", schema: str },
        { name: "author", in: "query", schema: str },
        { name: "format", in: "query", schema: str },
        { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "Newsroom day (UTC+6)" },
      ],
    },
  },
  "/articles/popular": { get: { summary: "Most read: page views over the last 7 days", tags: ["Public"], params: [locale] } },
  "/articles/breaking": { get: { summary: "Stories with an active breaking banner", tags: ["Public"], params: [locale] } },
  "/articles/by-slug/{slug}": {
    get: { summary: "Story detail; returns {redirect} for a changed slug", tags: ["Public"], params: [slug, locale], responses: { "404": "Not found" } },
  },
  "/articles/{id}/related": { get: { summary: "Related stories", tags: ["Public"], params: [id(), locale] } },
  "/articles/{id}/view": {
    post: { summary: "Count one anonymous view", tags: ["Public"], params: [id()], body: obj({ referrer: str }), responses: { "204": "Counted" } },
  },
  "/search": {
    get: {
      summary: "Search published stories",
      tags: ["Public"],
      params: [locale, page, limit, { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 100 } }, { name: "category", in: "query", schema: str }, { name: "author", in: "query", schema: str }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }],
    },
  },
  "/search/suggest": { get: { summary: "Headline suggestions", tags: ["Public"], params: [locale, { name: "q", in: "query", required: true, schema: str }] } },
  "/categories": { get: { summary: "Active sections", tags: ["Public"], params: [locale] } },
  "/categories/{slug}": { get: { summary: "Section with parent and children", tags: ["Public"], params: [slug, locale] } },
  "/tags": { get: { summary: "Topics ranked by published story count", tags: ["Public"], params: [locale] } },
  "/tags/{slug}": { get: { summary: "Topic", tags: ["Public"], params: [slug, locale] } },
  "/authors": { get: { summary: "Public bylines", tags: ["Public"], params: [locale] } },
  "/authors/{slug}": { get: { summary: "Author profile", tags: ["Public"], params: [slug, locale] } },
  "/archive/{year}/{month}": {
    get: { summary: "Days with published stories", tags: ["Public"], params: [{ name: "year", in: "path", required: true, schema: int }, { name: "month", in: "path", required: true, schema: int }, locale] },
  },
  "/sitemap/articles": { get: { summary: "Canonical published URLs for sitemaps", tags: ["Public"], params: [locale, page, { name: "since", in: "query", schema: { type: "string", format: "date-time" } }] } },
  "/pages": { get: { summary: "Published editorial pages", tags: ["Public"], params: [locale] } },
  "/pages/{key}": { get: { summary: "Editorial page", tags: ["Public"], params: [{ name: "key", in: "path", required: true, schema: str }, locale] } },
  "/ads/placements": { get: { summary: "Enabled ad placements", tags: ["Public"] } },

  "/auth/csrf": { get: { summary: "Issue a CSRF token (also set as an HttpOnly cookie)", tags: ["Auth"] } },
  "/auth/session": {
    post: { summary: "Exchange a fresh Firebase ID token for a session cookie", tags: ["Auth"], auth: "csrf", body: obj({ idToken: str }, ["idToken"]), responses: { "401": "Token invalid or sign-in too old" } },
  },
  "/auth/logout": { post: { summary: "Clear the session cookie", tags: ["Auth"], auth: "csrf", responses: { "204": "Signed out" } } },
  "/auth/me": { get: { summary: "Current profile and permissions", tags: ["Auth"], auth: "session" } },

  "/me/preferences": { patch: { summary: "Update reading preferences", tags: ["Reader"], auth: "session", body: obj({ theme: str, textSize: str, locale: str }) } },
  "/me/bookmarks": { get: { summary: "Saved stories", tags: ["Reader"], auth: "session", params: [locale, page, limit] } },
  "/me/bookmarks/ids": { get: { summary: "Saved story group ids", tags: ["Reader"], auth: "session" } },
  "/me/bookmarks/{group}": {
    put: { summary: "Save a story", tags: ["Reader"], auth: "session", params: [id("group")], responses: { "204": "Saved" } },
    delete: { summary: "Remove a saved story", tags: ["Reader"], auth: "session", params: [id("group")], responses: { "204": "Removed" } },
  },
  "/me/follows": {
    get: { summary: "Followed sections and topics", tags: ["Reader"], auth: "session", params: [locale] },
    put: { summary: "Replace followed sections and topics", tags: ["Reader"], auth: "session", body: obj({ categories: { type: "array", items: str }, tags: { type: "array", items: str } }) },
  },
  "/me/feed": { get: { summary: "Stories from followed sections and topics", tags: ["Reader"], auth: "session", params: [locale, page, limit] } },
  "/me/export": { get: { summary: "Download personal data as JSON", tags: ["Reader"], auth: "session" } },
  "/me": { delete: { summary: "Delete account and sign-in", tags: ["Reader"], auth: "session", body: obj({ confirm: { const: "DELETE" } }, ["confirm"]), responses: { "204": "Deleted" } } },

  "/newsletter/subscribe": { post: { summary: "Start double opt-in (always 202)", tags: ["Newsletter"], body: obj({ email: str, locale: str, website: { type: "string", description: "honeypot; leave empty" } }, ["email", "locale"]), responses: { "202": "Check inbox", "503": "Newsletter not configured" } } },
  "/newsletter/confirm": { post: { summary: "Confirm subscription", tags: ["Newsletter"], body: obj({ token: str }, ["token"]) } },
  "/newsletter/unsubscribe": { post: { summary: "Unsubscribe", tags: ["Newsletter"], body: obj({ token: str }, ["token"]) } },

  "/admin/articles": {
    get: { summary: "Newsroom story list (authors see their own)", tags: ["CMS"], auth: "staff", params: [page, limit, { name: "status", in: "query", schema: str }, { name: "locale", in: "query", schema: str }, { name: "category", in: "query", schema: str }, { name: "q", in: "query", schema: str }, { name: "mine", in: "query", schema: str }, { name: "sort", in: "query", schema: str }] },
    post: { summary: "Create a draft (optionally as a translation)", tags: ["CMS"], auth: "staff", body: obj({ ...articleFields, locale: str, translationOf: str }, ["title", "locale"]) },
  },
  "/admin/articles/bulk": { post: { summary: "Confirmed bulk submit/unpublish/archive", tags: ["CMS"], auth: "staff", body: obj({ ids: { type: "array", items: str }, action: str, confirm: { const: true } }, ["ids", "action", "confirm"]) } },
  "/admin/articles/{id}": {
    get: { summary: "Story with checklist, translations and allowed actions", tags: ["CMS"], auth: "staff", params: [id()] },
    patch: { summary: "Update with optimistic concurrency (409 on conflict)", tags: ["CMS"], auth: "staff", params: [id()], body: obj({ ...articleFields, version: int, revision: { type: "string", enum: ["manual", "autosave"] }, markUpdated: bool }, ["version"]), responses: { "409": "Edited by someone else" } },
  },
  "/admin/articles/{id}/transition": {
    post: { summary: "Workflow action", tags: ["CMS"], auth: "staff", params: [id()], body: obj({ action: { type: "string", enum: ["submit", "withdraw", "publish", "schedule", "unschedule", "unpublish", "archive", "restore"] }, version: int, scheduledFor: { type: "string", format: "date-time" } }, ["action", "version"]) },
  },
  "/admin/articles/{id}/notes": { post: { summary: "Add an editorial note", tags: ["CMS"], auth: "staff", params: [id()], body: obj({ text: str }, ["text"]) } },
  "/admin/articles/{id}/revisions": { get: { summary: "Revision history", tags: ["CMS"], auth: "staff", params: [id()] } },
  "/admin/articles/{id}/revisions/{revisionId}/restore": { post: { summary: "Restore a revision", tags: ["CMS"], auth: "staff", params: [id(), id("revisionId")], body: obj({ version: int }, ["version"]) } },
  "/admin/media": {
    get: { summary: "Media library with usage counts", tags: ["CMS"], auth: "staff", params: [page, limit] },
    post: { summary: "Upload an image (multipart: file, alt_bn, alt_en, caption_bn, caption_en, credit)", tags: ["CMS"], auth: "staff", responses: { "413": "Too large", "415": "Not an allowed image", "503": "Storage not configured" } },
  },
  "/admin/media/{id}": { patch: { summary: "Edit alt text, caption, credit, focal point", tags: ["CMS"], auth: "staff", params: [id()], body: obj({ alt: localized, caption: localized, credit: str, focalX: { type: "number" }, focalY: { type: "number" } }) } },
  "/admin/categories": { get: { summary: "All sections", tags: ["CMS"], auth: "staff" }, post: { summary: "Create section", tags: ["CMS"], auth: "staff", body: obj({ name: localized, slug: localized, description: localized, parent: str, order: int, isActive: bool }, ["name", "slug"]) } },
  "/admin/categories/{id}": { patch: { summary: "Update section", tags: ["CMS"], auth: "staff", params: [id()] } },
  "/admin/tags": { get: { summary: "Search tags", tags: ["CMS"], auth: "staff" }, post: { summary: "Create tag", tags: ["CMS"], auth: "staff", body: obj({ name: localized, slug: localized }, ["name"]) } },
  "/admin/tags/{id}": { patch: { summary: "Update tag", tags: ["CMS"], auth: "staff", params: [id()] }, delete: { summary: "Delete an unused tag", tags: ["CMS"], auth: "staff", params: [id()] } },
  "/admin/users": { get: { summary: "Users (admin)", tags: ["CMS"], auth: "staff", params: [page, limit] } },
  "/admin/users/{id}": { patch: { summary: "Change role, publishing permission, status, byline (admin)", tags: ["CMS"], auth: "staff", params: [id()] } },
  "/admin/users/me/author": { patch: { summary: "Edit own byline", tags: ["CMS"], auth: "staff" } },
  "/admin/users/staff": { get: { summary: "Newsroom staff for byline pickers", tags: ["CMS"], auth: "staff" } },
  "/admin/settings/homepage": { get: { summary: "Homepage section order", tags: ["CMS"], auth: "staff" }, put: { summary: "Save homepage section order", tags: ["CMS"], auth: "staff" } },
  "/admin/ads": { get: { summary: "Ad placements", tags: ["CMS"], auth: "staff" } },
  "/admin/ads/{key}": { put: { summary: "Configure an ad placement", tags: ["CMS"], auth: "staff", params: [{ name: "key", in: "path", required: true, schema: str }] } },
  "/admin/pages": { get: { summary: "Editorial pages", tags: ["CMS"], auth: "staff" } },
  "/admin/pages/{key}/{locale}": { get: { summary: "Editorial page", tags: ["CMS"], auth: "staff" }, put: { summary: "Save editorial page", tags: ["CMS"], auth: "staff" } },
  "/admin/dashboard": { get: { summary: "Workflow queues, health warnings, activity and traffic", tags: ["CMS"], auth: "staff" } },
  "/admin/audit": { get: { summary: "Audit log (admin)", tags: ["CMS"], auth: "staff", params: [page, limit] } },
};

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { code: str, message: str, details: {}, requestId: str },
      required: ["code", "message", "requestId"],
    },
  },
};

function build() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, methods] of Object.entries(ops)) {
    paths[path] = {};
    for (const [method, op] of Object.entries(methods)) {
      const security =
        op.auth === "session" || op.auth === "staff"
          ? [{ sessionCookie: [], csrfHeader: [] }, { bearerIdToken: [] }]
          : op.auth === "csrf"
            ? [{ csrfHeader: [] }]
            : [];
      paths[path][method] = {
        summary: op.summary,
        tags: op.tags,
        ...(security.length ? { security } : {}),
        ...(op.params ? { parameters: op.params } : {}),
        ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: op.body } } } } : {}),
        responses: {
          "200": { description: "OK" },
          ...Object.fromEntries(Object.entries(op.responses ?? {}).map(([code, description]) => [code, { description }])),
          "400": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
          ...(op.auth === "session" || op.auth === "staff"
            ? { "401": { $ref: "#/components/responses/Error" }, "403": { $ref: "#/components/responses/Error" } }
            : {}),
        },
      };
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "The Morning Bulletin API",
      version: "1.0.0",
      description:
        "Versioned REST API. Successful responses use {data, meta?}; errors use {error:{code,message,details?,requestId}}. Cookie-authenticated mutations require the X-CSRF-Token header.",
    },
    servers: [{ url: "/api/v1" }],
    paths,
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "khoka_session", description: "__Host-khoka_session in production" },
        csrfHeader: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
        bearerIdToken: { type: "http", scheme: "bearer", description: "Firebase ID token" },
      },
      schemas: { Error: errorSchema },
      responses: { Error: { description: "Error", content: { "application/json": { schema: errorSchema } } } },
    },
  };
}

export const openApiDocument = build();
