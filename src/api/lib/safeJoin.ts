import * as path from "node:path";

/**
 * Path-traversal-safe join. Resolves `base` + `segments` and verifies the
 * result remains inside `base`. Throws on traversal attempts or null bytes.
 *
 * Use this for every filesystem path built from a user-provided slug or
 * filename (e.g., `brands/<slug>/assets/<filename>`).
 */
export function safeJoin(base: string, ...segments: string[]): string {
  for (const segment of segments) {
    if (typeof segment !== "string") {
      throw new Error("safeJoin: segment must be a string");
    }
    // eslint-disable-next-line no-control-regex
    if (/[\x00]/.test(segment)) {
      throw new Error("safeJoin: null byte in segment");
    }
  }

  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, ...segments);

  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error("safeJoin: path traversal attempt blocked");
  }

  return resolved;
}

/** Slug format per spec: lowercase alphanumerics and hyphens only. */
const SLUG_RE = /^[a-z0-9-]+$/;

/** Validate a brand slug. Throws on invalid input. Returns the slug unchanged. */
export function validateSlug(slug: unknown): string {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 100) {
    throw new Error("Invalid slug");
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error("Invalid slug — must be lowercase a-z, 0-9, and hyphens only");
  }
  return slug;
}

/** Validate a flat asset filename (no path separators, no traversal). */
const FILENAME_RE = /^[A-Za-z0-9._-]+$/;

export function validateAssetFilename(filename: unknown): string {
  if (typeof filename !== "string" || filename.length === 0 || filename.length > 255) {
    throw new Error("Invalid filename");
  }
  if (filename === "." || filename === ".." || filename.startsWith(".")) {
    throw new Error("Invalid filename — hidden/dot files not allowed");
  }
  if (!FILENAME_RE.test(filename)) {
    throw new Error("Invalid filename — only [A-Za-z0-9._-] allowed");
  }
  return filename;
}
