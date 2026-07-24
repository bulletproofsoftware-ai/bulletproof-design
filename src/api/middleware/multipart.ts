/**
 * SPEC-004 multipart upload middleware.
 *
 * Wraps `multer` (v2.x, the security-maintained branch) in memory storage
 * with strict size and MIME filters. Exposes a single `uploadLogo` middleware
 * consumed by `POST /api/brands/:slug/logos`.
 *
 * Design choices:
 *   - **Memory storage** — files are small (≤ 5 MB) and must be fully in
 *     memory for the SVG sanitizer to run before any byte touches disk. If
 *     we used diskStorage, an unsanitized attacker-controlled SVG would
 *     exist on disk (however briefly) before the sanitizer could rewrite it.
 *   - **Size cap at the parser layer** — any file exceeding 5 MB is aborted
 *     by multer before reaching our handler, returning 413.
 *   - **MIME allowlist at the fileFilter layer** — non-image/svg+png/jpeg
 *     uploads are rejected before memory allocation.
 *   - **Exactly one file field** (`file`) — we refuse arrays and unexpected
 *     fields.
 */

import multer, { MulterError, type FileFilterCallback } from "multer";
import type { Request } from "express";

/** Hard cap on uploaded logo file size, in bytes. Referenced by tests. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Total form body cap (file + fields). Slightly above file cap. */
export const MAX_FORM_BYTES = 6 * 1024 * 1024;

/** MIME allowlist for logo uploads. */
export const ALLOWED_LOGO_MIMES: readonly string[] = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
];

/** Canonical file extension for a given MIME type. */
export function extensionForMime(mime: string): "svg" | "png" | "jpg" {
  switch (mime) {
    case "image/svg+xml":
      return "svg";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      // Defensive — fileFilter should prevent this branch.
      throw new Error(`Unsupported MIME type: ${mime}`);
  }
}

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (!ALLOWED_LOGO_MIMES.includes(file.mimetype)) {
    // Pass a typed error so the route handler can translate to a 415
    // response. We use MulterError with LIMIT_UNEXPECTED_FILE so multer's
    // own error path fires without us needing to plug into express-async.
    cb(new MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    return;
  }
  cb(null, true);
}

/** Multer instance for logo uploads — memory storage, hard limits. */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_LOGO_BYTES,
    files: 1,
    // Caps the total size of non-file form fields at 64 KB — enough for
    // label/usage/preferred/filename, far too small for a payload smuggled
    // out of the file field into a text field.
    fieldSize: 64 * 1024,
    fields: 16,
    parts: 20,
  },
  fileFilter,
});

/**
 * Middleware: `.single('file')` — accepts at most one file under the field
 * name `file`. Route handler receives the file at `req.file`.
 */
export const uploadLogo = logoUpload.single("file");
