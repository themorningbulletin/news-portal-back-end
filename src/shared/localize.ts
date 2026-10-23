import type { Locale, Localized } from "./constants.js";

export const pick = (value: Localized | undefined, locale: Locale): string => value?.[locale] ?? "";
export const otherLocale = (locale: Locale): Locale => (locale === "bn" ? "en" : "bn");
