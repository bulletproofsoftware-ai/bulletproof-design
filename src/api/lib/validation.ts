/**
 * Shared input validation helpers for the Design Library API.
 *
 * Used by route handlers to validate user-supplied parameters, query strings,
 * and request body fields before they reach business logic or the filesystem.
 */

/**
 * Validates a route parameter or body field value.
 * Allows alphanumeric characters, hyphens, and underscores only.
 * Max length 100 characters.
 *
 * Accepts `unknown` and narrows to `string` so Express 5's
 * `ParamsDictionary[key] = string | string[]` callers can guard in-place
 * without explicit casts. A non-string value (e.g. array, undefined) is
 * rejected outright.
 */
export function validateParam(param: unknown): param is string {
  if (typeof param !== "string") return false;
  return /^[a-zA-Z0-9_-]+$/.test(param) && param.length <= 100;
}

/**
 * Validates a search query string.
 * Rejects control characters and excessively long input.
 */
export function validateSearchQuery(query: string): boolean {
  // Express gives `string | string[]` for a repeated query parameter, so
  // ?q=a&q=b arrives as an array. Without this guard `.length` measures the
  // number of values rather than the text, and `.test()` coerces the array to
  // a comma-joined string — a two-element array of 150 chars each passes a
  // check meant to cap input at 200 (CodeQL
  // js/type-confusion-through-parameter-tampering).
  if (typeof query !== "string") return false;
  // eslint-disable-next-line no-control-regex
  return query.length <= 200 && !/[\x00-\x1f]/.test(query);
}

/**
 * Validates a filename (used in asset uploads).
 * Allows alphanumeric, hyphens, underscores, dots. No path separators.
 */
export function validateFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(filename) && filename.length <= 255;
}

/**
 * Validates that a value is a string and its length does not exceed maxLength.
 * Returns true if valid. Rejects non-strings and strings exceeding the limit.
 */
export function validateStringLength(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

/**
 * Validates that a value is an array and its length does not exceed maxItems.
 * If `itemMaxLength` is provided, also validates each item is a string within that length.
 */
export function validateArray(value: unknown, maxItems: number, itemMaxLength?: number): value is unknown[] {
  if (!Array.isArray(value)) return false;
  if (value.length > maxItems) return false;
  if (itemMaxLength !== undefined) {
    return value.every((item) => typeof item === "string" && item.length <= itemMaxLength);
  }
  return true;
}

/**
 * Validates that a value is a plain object and does not have more keys than maxKeys.
 */
export function validateObjectKeys(value: unknown, maxKeys: number): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).length <= maxKeys;
}

/** Maximum number of results returned by list/search endpoints. */
export const MAX_RESULTS = 100;

/** Maximum number of items in an array body field (e.g. tags). */
export const MAX_ARRAY_ITEMS = 100;

/** Maximum length for short text fields (name, description, slug). */
export const MAX_SHORT_TEXT = 200;

/** Maximum length for individual tag strings. */
export const MAX_TAG_LENGTH = 100;

/** Maximum number of keys in a brand config object. */
export const MAX_BRAND_KEYS = 50;

/**
 * Sanitises an error message before including it in an API response.
 * Strips potential stack traces and truncates to a safe length.
 */
export function sanitizeErrorMessage(msg: string): string {
  // Take only the first line and cap length
  const firstLine = msg.split("\n")[0] ?? "";
  return firstLine.slice(0, 200);
}
