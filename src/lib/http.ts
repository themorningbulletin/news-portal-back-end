import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { AppError } from "./errors.js";

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      "validation_failed",
      "The request did not pass validation",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })),
    );
  }
  return result.data;
}

export const objectId = z
  .string()
  .refine((v) => /^[a-f0-9]{24}$/i.test(v) && isValidObjectId(v), "must be a valid id")
  .transform((v) => new Types.ObjectId(v));

export const localeSchema = z.enum(["bn", "en"]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const idParams = z.object({ id: objectId });
