export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "csrf_failed"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "feature_disabled"
  | "upstream_failed"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  csrf_failed: 403,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  feature_disabled: 503,
  upstream_failed: 502,
  internal: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Resource") => new AppError("not_found", `${what} not found`);
export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError("forbidden", message);
export const badRequest = (message: string, details?: unknown) => new AppError("bad_request", message, details);
export const conflict = (message: string, details?: unknown) => new AppError("conflict", message, details);
