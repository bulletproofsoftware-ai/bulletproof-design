import { Router, Request, Response, NextFunction } from "express";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { MulterError } from "multer";
import {
  getAll,
  getBySlug,
  getBrandColors,
  getBrandFonts,
  getBrandAssetFiles,
  generateCssVariables,
  BrandConfig,
} from "../lib/brandIndex";
import { writeBrandSync, deleteBrandSync } from "../lib/brandWriter";
import {
  validateParam,
  sanitizeErrorMessage,
  validateStringLength,
  validateObjectKeys,
  MAX_SHORT_TEXT,
  MAX_BRAND_KEYS,
} from "../lib/validation";
import { sanitizePathParam } from "../lib/sanitize";
import { safeJoin, validateSlug } from "../lib/safeJoin";
import { publicAccess, requireApiKey } from "../middleware/auth";
import { logAudit } from "../lib/auditLogger";
import { isRoleGroupedColors } from "../../../lib/types/brand";
import type { LogoEntry, Logos, Typography } from "../../../lib/types/brand";
import { sanitizeSvg } from "../lib/svgSanitizer";
import {
  uploadLogo,
  MAX_LOGO_BYTES,
  ALLOWED_LOGO_MIMES,
  extensionForMime,
} from "../middleware/multipart";
import { parseGuidelines } from "../lib/guidelinesParser";

// Resolve the brands directory lazily from env so tests can override it via
// BRANDS_DIR. Mirrors the pattern used in server.ts and the assets route.
function brandsDir(): string {
  return process.env.BRANDS_DIR ?? "./brands";
}

const router = Router();

/**
 * Strip the internal `_source` marker before returning a brand over the wire.
 * Clients should not see or depend on this field.
 */
function stripInternal(brand: BrandConfig): Omit<BrandConfig, "_source"> {
  const { _source: _drop, ...rest } = brand;
  void _drop;
  return rest;
}

/**
 * GET /api/brands
 *
 * Returns all brands with summary info (name, slug, description, primary color).
 */
router.get("/", publicAccess, (_req: Request, res: Response) => {
  const brands = getAll();
  res.json({ brands });
});

/**
 * GET /api/brands/:slug
 *
 * Returns the full brand configuration JSON. The response shape is a union —
 * `colors` may be a flat `Record<string, string>` or a role-grouped object.
 */
router.get("/:slug", publicAccess, (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }
  const brand = getBySlug(slug);

  if (!brand) {
    res.status(404).json({ error: "Brand not found", slug });
    return;
  }

  res.json(stripInternal(brand));
});

/**
 * GET /api/brands/:slug/colors
 *
 * Returns the brand's colors in whatever shape they are stored. Clients
 * detect the shape and render appropriately.
 */
router.get("/:slug/colors", publicAccess, (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }
  const colors = getBrandColors(slug);

  if (colors === undefined) {
    res.status(404).json({ error: "Brand not found", slug });
    return;
  }

  res.json({
    slug,
    colors,
    shape: isRoleGroupedColors(colors) ? "role-grouped" : "flat",
  });
});

/**
 * GET /api/brands/:slug/fonts
 *
 * Returns just the font configuration for a brand.
 */
router.get("/:slug/fonts", publicAccess, (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }
  const fonts = getBrandFonts(slug);

  if (!fonts) {
    res.status(404).json({ error: "Brand not found", slug });
    return;
  }

  res.json({ slug, fonts });
});

/**
 * GET /api/brands/:slug/css-variables
 *
 * Returns CSS custom properties string for the brand. Emits `--brand-*` for
 * flat brands and `--color-<group>-<name>` for role-grouped brands.
 */
router.get("/:slug/css-variables", publicAccess, (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }
  const css = generateCssVariables(slug);

  if (!css) {
    res.status(404).json({ error: "Brand not found", slug });
    return;
  }

  res.setHeader("Content-Type", "text/css");
  res.send(css);
});

/**
 * GET /api/brands/:slug/assets
 *
 * Returns brand asset URLs.
 *
 * For directory-format brands: lists files in `brands/<slug>/assets/` and
 * exposes them under `/assets/brands/<slug>/<file>`.
 *
 * For flat brands with a legacy `logo: { mark, horizontal, favicon }` field,
 * returns the legacy URL map (pointing at `/assets/brands/<file>`).
 */
router.get("/:slug/assets", publicAccess, (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }
  const brand = getBySlug(slug);

  if (!brand) {
    res.status(404).json({ error: "Brand not found", slug });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const assets: Record<string, string> = {};

  if (brand._source === "directory") {
    // New directory format — enumerate real files in assets/.
    const brandsDir = process.env.BRANDS_DIR ?? "./brands";
    const files = getBrandAssetFiles(brandsDir, slug);
    for (const file of files) {
      // Use the filename (without extension) as the logical key.
      const key = path.basename(file, path.extname(file));
      assets[key] = `${baseUrl}/assets/brands/${slug}/${file}`;
    }

    // Also surface the logos manifest if present (spec §1.1 REQ-004).
    const logos = brand.logos;
    if (logos && typeof logos === "object") {
      res.json({ slug, assets, logos });
      return;
    }
  } else {
    // Flat format — fall back to legacy `logo: { mark, horizontal, favicon }`.
    const logo = brand.logo;
    if (logo && typeof logo === "object") {
      for (const [key, filename] of Object.entries(logo)) {
        if (typeof filename === "string" && filename.length > 0) {
          assets[key] = `${baseUrl}/assets/brands/${filename}`;
        }
      }
    }
  }

  res.json({ slug, assets });
});

/**
 * POST /api/brands
 *
 * Creates a new brand in directory format.
 *
 * Body: BrandConfig JSON (name, slug, colors required).
 * Returns 201 on success, 400 on validation failure, 409 on duplicate slug.
 */
router.post("/", requireApiKey, async (req: Request, res: Response) => {
  const brandConfig = req.body;

  if (!brandConfig.name || !brandConfig.slug || !brandConfig.colors) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["name", "slug", "colors"],
    });
    return;
  }

  if (!validateStringLength(brandConfig.name, MAX_SHORT_TEXT)) {
    res.status(400).json({ error: `name must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }
  if (
    brandConfig.description !== undefined &&
    !validateStringLength(brandConfig.description, MAX_SHORT_TEXT)
  ) {
    res.status(400).json({ error: `description must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }
  if (!validateObjectKeys(brandConfig, MAX_BRAND_KEYS)) {
    res.status(400).json({ error: `Brand config exceeds maximum of ${MAX_BRAND_KEYS} top-level keys` });
    return;
  }
  if (brandConfig.colors && !validateObjectKeys(brandConfig.colors, 20)) {
    res.status(400).json({ error: "colors object exceeds maximum of 20 keys" });
    return;
  }

  if (!validateParam(brandConfig.slug)) {
    res.status(400).json({ error: "Invalid or missing field: slug" });
    return;
  }

  let safeSlug: string;
  try {
    safeSlug = sanitizePathParam(brandConfig.slug);
  } catch {
    res.status(400).json({ error: "Invalid slug parameter" });
    return;
  }
  brandConfig.slug = safeSlug;

  const existing = getBySlug(safeSlug);
  if (existing) {
    res.status(409).json({
      error: "Brand already exists",
      slug: safeSlug,
    });
    return;
  }

  try {
    // Shape has been validated above (required fields, lengths, key counts,
    // slug format). Runtime validation exceeds what the TS narrowing can
    // express on `Record<string, unknown>`, so cast to BrandConfig here.
    const result = writeBrandSync(brandConfig as unknown as BrandConfig);
    logAudit(req, "success");
    res.status(201).json({
      status: "created",
      slug: brandConfig.slug,
      name: brandConfig.name,
      path: result.path,
    });
  } catch (err) {
    logAudit(req, "error");
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: "Failed to write brand", details: sanitizeErrorMessage(msg) });
  }
});

/**
 * PUT /api/brands/:slug
 *
 * Updates (overwrites) an existing brand. Slug is taken from URL params.
 * Format follows `writeBrandSync` — directory format. Existing flat brands
 * become directory brands on next PUT (migration script is the preferred
 * path, but this guarantees forward progress).
 */
router.put("/:slug", requireApiKey, async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }

  let safeSlug: string;
  try {
    safeSlug = sanitizePathParam(slug);
  } catch {
    res.status(400).json({ error: "Invalid slug parameter" });
    return;
  }

  const brandConfig = { ...req.body, slug: safeSlug };

  if (
    brandConfig.name !== undefined &&
    !validateStringLength(brandConfig.name, MAX_SHORT_TEXT)
  ) {
    res.status(400).json({ error: `name must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }
  if (
    brandConfig.description !== undefined &&
    !validateStringLength(brandConfig.description, MAX_SHORT_TEXT)
  ) {
    res.status(400).json({ error: `description must be a string (max ${MAX_SHORT_TEXT} chars)` });
    return;
  }
  if (!validateObjectKeys(brandConfig, MAX_BRAND_KEYS)) {
    res.status(400).json({ error: `Brand config exceeds maximum of ${MAX_BRAND_KEYS} top-level keys` });
    return;
  }
  if (brandConfig.colors && !validateObjectKeys(brandConfig.colors, 20)) {
    res.status(400).json({ error: "colors object exceeds maximum of 20 keys" });
    return;
  }

  try {
    // Serialise concurrent PUT /:slug against the same slug through the
    // per-slug advisory lock. Logos upload/delete + guidelines already hold
    // this lock; the top-level brand config PUT is the last RMW member.
    const result = await withBrandLock(safeSlug, req, "brand.update", async () =>
      // Same rationale as POST — shape is runtime-validated above.
      writeBrandSync(brandConfig as unknown as BrandConfig),
    );
    logAudit(req, "success");
    res.json({
      status: "updated",
      slug: safeSlug,
      path: result.path,
    });
  } catch (err) {
    logAudit(req, "error");
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: "Failed to write brand", details: sanitizeErrorMessage(msg) });
  }
});

/**
 * DELETE /api/brands/:slug
 *
 * Deletes a brand. Removes the directory if present, otherwise the flat
 * `.json` file.
 */
router.delete("/:slug", requireApiKey, async (req: Request, res: Response) => {
  const { slug } = req.params;
  if (!validateParam(slug)) {
    res.status(400).json({ error: "Invalid parameter: slug" });
    return;
  }

  let safeSlug: string;
  try {
    safeSlug = sanitizePathParam(slug);
  } catch {
    res.status(400).json({ error: "Invalid slug parameter" });
    return;
  }

  try {
    // Serialise DELETE /:slug against concurrent writers for the same slug.
    const deleted = await withBrandLock(safeSlug, req, "brand.delete", async () =>
      deleteBrandSync(safeSlug),
    );
    if (!deleted) {
      res.status(404).json({ error: "Brand not found", slug: safeSlug });
      return;
    }
    logAudit(req, "success");
    res.json({ status: "deleted", slug: safeSlug });
  } catch (err) {
    logAudit(req, "error");
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: "Failed to delete brand", details: sanitizeErrorMessage(msg) });
  }
});

// ────────────────────────────────────────────────────────────────────────
// SPEC-004 — Brand identity, logos, typography (POST/DELETE require API key)
// Routes live ABOVE the guidelines block so the merge with SPEC-002 stays
// clean when it lands. Do NOT move past the SPEC-004 insertion point.
// ────────────────────────────────────────────────────────────────────────

/** Valid logo variant keys — enforced at request time. */
const LOGO_KEYS = ["horizontal", "vertical", "icon"] as const;
type LogoKey = (typeof LOGO_KEYS)[number];

function isLogoKey(value: unknown): value is LogoKey {
  return typeof value === "string" && (LOGO_KEYS as readonly string[]).includes(value);
}

/** Extension → MIME type for static serving. */
function mimeFromExt(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return null;
  }
}

/**
 * Per-slug advisory write lock (CISO F-UPLOAD-04).
 *
 * Serialises concurrent writes against the same brand without hard-failing
 * the second writer. Callers await the existing promise before launching
 * their own work, and always chain the promise (success OR failure) so the
 * next waiter runs.
 *
 * NOTE: in-process only — for multi-process deploys, promote to a
 * filesystem lock on `brands/<slug>/.write-lock`.
 */
const brandWriteLocks = new Map<string, Promise<unknown>>();

async function withBrandLock<T>(
  slug: string,
  req: Request,
  operation: string,
  work: () => Promise<T>,
): Promise<T> {
  const existing = brandWriteLocks.get(slug);
  if (existing) {
    // Contention detected — emit structured warning for audit BEFORE
    // awaiting the prior writer (so the event ordering reflects arrival
    // time, not completion time).
    logAudit(
      req,
      "success",
      undefined,
      `brand.write.concurrent slug=${slug} op=${operation}`,
    );
    try {
      await existing;
    } catch {
      // prior writer failed — we still want our turn.
    }
  }

  // Install our lock slot BEFORE starting work. We use a dedicated
  // `release` promise (not the work promise itself) so that the next
  // waiter's `await existing` resolves deterministically in the `finally`
  // block below — independent of how `work()` settles, and without
  // relying on a floating `.finally().catch()` microtask chain.
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  brandWriteLocks.set(slug, gate);

  try {
    return await work();
  } finally {
    // Only clear the slot if we are still the registered holder — a later
    // concurrent writer may have already overwritten it by the time we
    // reach here (they chain onto our `gate`, not the work promise).
    if (brandWriteLocks.get(slug) === gate) {
      brandWriteLocks.delete(slug);
    }
    // Release any waiter that chained on our gate. Always called, even
    // if `work()` threw — errors propagate to the caller unchanged.
    release();
  }
}

/**
 * Build the absolute path to the brand's assets directory and ensure it
 * exists (directory-format brands only). Returns `null` if the brand is not
 * a directory brand (flat legacy brands cannot hold managed logos).
 */
async function ensureAssetsDir(slug: string): Promise<string | null> {
  const brand = getBySlug(slug);
  if (!brand) return null;
  const root = brandsDir();
  let assetsDir: string;
  try {
    assetsDir = safeJoin(root, slug, "assets");
  } catch {
    return null;
  }
  try {
    await fsp.mkdir(assetsDir, { recursive: true });
  } catch {
    return null;
  }
  return assetsDir;
}

/** Build a public URL for a brand asset — served by the static route. */
function assetUrl(slug: string, file: string): string {
  return `/brand-assets/${slug}/${file}`;
}

/**
 * Augment a raw `LogoEntry` (as stored in brand.json) with a resolved URL
 * for client consumption (REQ-031).
 */
function withUrl(slug: string, entry: LogoEntry): LogoEntry & { url: string } {
  return { ...entry, url: assetUrl(slug, entry.file) };
}

/**
 * Read and parse brand.json for a directory brand. Returns `null` if missing
 * or unparseable. Used by the write path so we always read the freshest
 * on-disk state (the in-memory index may be a few fs events behind).
 */
async function readBrandJson(
  slug: string,
): Promise<{ path: string; config: BrandConfig } | null> {
  let filePath: string;
  try {
    filePath = safeJoin(brandsDir(), slug, "brand.json");
  } catch {
    return null;
  }
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    return { path: filePath, config: JSON.parse(raw) as BrandConfig };
  } catch {
    return null;
  }
}

/**
 * Atomic write of `brand.json` via `<file>.tmp-<pid>-<ts>` → rename.
 */
async function writeBrandJsonAtomic(
  filePath: string,
  config: BrandConfig,
): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  await fsp.rename(tmpPath, filePath);
}

/**
 * GET /api/brands/:slug/identity — REQ-030.
 *
 * Returns the aggregated visual identity for a brand: `{colors, typography,
 * logos}`. Logo entries are augmented with resolved URLs. Works for both
 * directory-format and flat brands (flat brands get `typography: null` and
 * an empty logos map).
 */
router.get(
  "/:slug/identity",
  publicAccess,
  (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      return;
    }
    const brand = getBySlug(slug);
    if (!brand) {
      // REQ-079 — normalized 404 shape.
      res.status(404).json({ error: "Brand not found", slug });
      return;
    }

    const logos: Record<string, LogoEntry & { url: string }> = {};
    if (brand.logos) {
      for (const key of LOGO_KEYS) {
        const entry = brand.logos[key];
        if (entry) logos[key] = withUrl(slug, entry);
      }
    }

    res.json({
      slug,
      colors: brand.colors,
      typography: brand.typography ?? null,
      logos,
    });
  },
);

/**
 * GET /api/brands/:slug/logos — REQ-031.
 *
 * Returns `{horizontal?, vertical?, icon?}` with each entry augmented with
 * a resolved URL. Absent variants are simply omitted.
 */
router.get(
  "/:slug/logos",
  publicAccess,
  (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      return;
    }
    const brand = getBySlug(slug);
    if (!brand) {
      res.status(404).json({ error: "Brand not found", slug });
      return;
    }

    const out: Record<string, LogoEntry & { url: string }> = {};
    if (brand.logos) {
      for (const key of LOGO_KEYS) {
        const entry = brand.logos[key];
        if (entry) out[key] = withUrl(slug, entry);
      }
    }

    res.json({ slug, logos: out });
  },
);

/**
 * GET /api/brands/:slug/typography — REQ-032.
 *
 * Returns the `typography` block verbatim (or `null` when absent).
 */
router.get(
  "/:slug/typography",
  publicAccess,
  (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      return;
    }
    const brand = getBySlug(slug);
    if (!brand) {
      res.status(404).json({ error: "Brand not found", slug });
      return;
    }
    res.json({ slug, typography: (brand.typography as Typography) ?? null });
  },
);

/**
 * Error-translating wrapper around the multer middleware. Multer surfaces
 * payload-too-large as `LIMIT_FILE_SIZE` and MIME-rejection (from our
 * fileFilter) as `LIMIT_UNEXPECTED_FILE`. Everything else collapses to 400.
 */
function runUploadLogo(req: Request, res: Response, next: NextFunction): void {
  uploadLogo(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: "Payload too large",
          maxBytes: MAX_LOGO_BYTES,
        });
        logAudit(req, "denied", 413, "logo file too large");
        return;
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(415).json({
          error:
            "Unsupported Media Type — allowed: " +
            ALLOWED_LOGO_MIMES.join(", "),
        });
        logAudit(req, "denied", 415, `logo mime rejected`);
        return;
      }
      if (
        err.code === "LIMIT_FIELD_VALUE" ||
        err.code === "LIMIT_FIELD_COUNT" ||
        err.code === "LIMIT_PART_COUNT"
      ) {
        res
          .status(413)
          .json({ error: "Form field too large or too many parts" });
        logAudit(req, "denied", 413, `multer ${err.code}`);
        return;
      }
    }
    res.status(400).json({
      error: "Invalid upload",
      details: sanitizeErrorMessage(
        err instanceof Error ? err.message : String(err),
      ),
    });
    logAudit(req, "denied", 400, "multer error");
  });
}

/**
 * POST /api/brands/:slug/logos — REQ-035, REQ-066, REQ-073, REQ-084 (SVG
 * sanitizer), REQ-085 (content-addressable filenames), REQ-086 (write lock).
 *
 * Multipart form:
 *   - `file`      (required) — the asset bytes (svg/png/jpg, ≤ 5 MB).
 *   - `key`       (required) — `horizontal` | `vertical` | `icon`.
 *   - `label`     (required) — short human-readable label (≤ 120 chars).
 *   - `usage`     (required) — usage guidance (≤ 500 chars).
 *   - `preferred` (optional) — `"true"` / `"false"`.
 *   - `filename`  (optional) — IGNORED per CISO F-UPLOAD-03; kept accepted
 *                              for backwards compatibility.
 *
 * Response: `201 { ok:true, slug, key, file, url }`.
 */
router.post(
  "/:slug/logos",
  requireApiKey,
  runUploadLogo,
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      logAudit(req, "denied", 400, "invalid slug");
      return;
    }

    let safeSlug: string;
    try {
      safeSlug = validateSlug(slug);
    } catch {
      res.status(400).json({ error: "Invalid slug parameter" });
      logAudit(req, "denied", 400, "invalid slug format");
      return;
    }

    // Normalised 404 — REQ-079. Must come BEFORE anything touches disk.
    const brandSummary = getBySlug(safeSlug);
    if (!brandSummary) {
      res.status(404).json({ error: "Brand not found", slug: safeSlug });
      logAudit(req, "denied", 404, "unknown slug");
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Missing file field" });
      logAudit(req, "denied", 400, "no file uploaded");
      return;
    }

    // ── Validate body fields ────────────────────────────────────────
    const keyRaw =
      typeof req.body?.key === "string" ? req.body.key : "";
    if (!isLogoKey(keyRaw)) {
      res.status(400).json({
        error: "Invalid or missing field: key",
        allowed: LOGO_KEYS,
      });
      logAudit(req, "denied", 400, "invalid logo key");
      return;
    }
    const logoKey: LogoKey = keyRaw;

    const label =
      typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (label.length < 1 || label.length > 120) {
      res.status(400).json({ error: "label must be 1..120 characters" });
      logAudit(req, "denied", 400, "invalid label");
      return;
    }
    const usage =
      typeof req.body?.usage === "string" ? req.body.usage.trim() : "";
    if (usage.length < 1 || usage.length > 500) {
      res.status(400).json({ error: "usage must be 1..500 characters" });
      logAudit(req, "denied", 400, "invalid usage");
      return;
    }

    let preferred: boolean | undefined;
    if (typeof req.body?.preferred === "string") {
      if (req.body.preferred === "true") preferred = true;
      else if (req.body.preferred === "false") preferred = false;
      else {
        res
          .status(400)
          .json({ error: "preferred must be 'true' or 'false'" });
        logAudit(req, "denied", 400, "invalid preferred");
        return;
      }
    }

    // ── Sanitise content (SVG only — PNG/JPEG are binary) ──────────
    let finalBytes: Buffer;
    if (file.mimetype === "image/svg+xml") {
      try {
        const sanitized = sanitizeSvg(file.buffer);
        finalBytes = Buffer.from(sanitized.output, "utf-8");
      } catch (err) {
        res.status(400).json({
          error: "Invalid SVG",
          details: sanitizeErrorMessage(
            err instanceof Error ? err.message : String(err),
          ),
        });
        logAudit(req, "denied", 400, "svg sanitization failed");
        return;
      }
    } else {
      finalBytes = file.buffer;
    }

    // ── Content-addressable filename (CISO F-UPLOAD-03) ────────────
    const hash = crypto.createHash("sha256").update(finalBytes).digest("hex");
    const ext = extensionForMime(file.mimetype);
    const finalName = `${logoKey}-${hash.slice(0, 12)}.${ext}`;

    // ── Ensure assets dir exists ───────────────────────────────────
    const assetsDir = await ensureAssetsDir(safeSlug);
    if (!assetsDir) {
      // Flat brand — cannot own managed logos. Return 409 so the client
      // knows to migrate rather than retrying.
      res.status(409).json({
        error:
          "Brand is not a directory brand — migrate before uploading logos",
        slug: safeSlug,
      });
      logAudit(req, "denied", 409, "flat brand rejected");
      return;
    }

    let destPath: string;
    try {
      destPath = safeJoin(assetsDir, finalName);
    } catch {
      res.status(400).json({ error: "Invalid asset path" });
      logAudit(req, "denied", 400, "safeJoin rejected asset name");
      return;
    }

    // ── Atomic write sequence under per-slug lock ──────────────────
    try {
      await withBrandLock(safeSlug, req, "logos.upload", async () => {
        const parsed = await readBrandJson(safeSlug);
        if (!parsed) {
          throw new Error("brand.json not readable");
        }
        const { path: brandJsonPath, config } = parsed;

        const logosObj: Logos = { ...(config.logos ?? {}) };
        const previous = logosObj[logoKey];
        logosObj[logoKey] = {
          file: finalName,
          label,
          usage,
          ...(preferred !== undefined ? { preferred } : {}),
        };
        const nextConfig: BrandConfig = { ...config, logos: logosObj };
        delete nextConfig._source;

        // 1. Write brand.json first (atomic rename).
        await writeBrandJsonAtomic(brandJsonPath, nextConfig);

        // 2. Write the sanitized asset. `wx` — fail if already exists,
        //    which is fine because identical content yields the same hash.
        try {
          await fsp.writeFile(destPath, finalBytes, { flag: "wx" });
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== "EEXIST") throw err;
          // EEXIST — identical file already on disk (idempotent).
        }

        // 3. Best-effort cleanup of the previous file if it differs.
        if (previous && previous.file && previous.file !== finalName) {
          try {
            const prevPath = safeJoin(assetsDir, previous.file);
            await fsp.unlink(prevPath);
          } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code !== "ENOENT") {
              logAudit(
                req,
                "success",
                undefined,
                `logos.cleanup.failed prev=${previous.file}`,
              );
            }
          }
        }
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to write logo",
        details: sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
        ),
      });
      logAudit(req, "error", 500, "logos.upload failed");
      return;
    }

    logAudit(
      req,
      "success",
      201,
      `logos.uploaded slug=${safeSlug} key=${logoKey} file=${finalName} bytes=${finalBytes.length}`,
    );
    res.status(201).json({
      ok: true,
      slug: safeSlug,
      key: logoKey,
      file: finalName,
      url: assetUrl(safeSlug, finalName),
    });
  },
);

/**
 * DELETE /api/brands/:slug/logos/:key — REQ-036, REQ-066, REQ-073.
 *
 * Removes `brand.json` logos[key] entry AND the on-disk file. 404 for
 * unknown slug or unregistered key, with the normalized shape from REQ-079.
 */
router.delete(
  "/:slug/logos/:key",
  requireApiKey,
  async (req: Request, res: Response) => {
    const { slug, key } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      logAudit(req, "denied", 400, "invalid slug");
      return;
    }
    let safeSlug: string;
    try {
      safeSlug = validateSlug(slug);
    } catch {
      res.status(400).json({ error: "Invalid slug parameter" });
      logAudit(req, "denied", 400, "invalid slug format");
      return;
    }
    if (!isLogoKey(key)) {
      res.status(400).json({
        error: "Invalid logo key",
        allowed: LOGO_KEYS,
        key,
      });
      logAudit(req, "denied", 400, "invalid logo key");
      return;
    }

    const brandSummary = getBySlug(safeSlug);
    if (!brandSummary) {
      res.status(404).json({ error: "Brand not found", slug: safeSlug });
      logAudit(req, "denied", 404, "unknown slug");
      return;
    }

    try {
      await withBrandLock(safeSlug, req, "logos.delete", async () => {
        const parsed = await readBrandJson(safeSlug);
        if (!parsed) throw new Error("brand.json not readable");
        const { path: brandJsonPath, config } = parsed;

        const logosObj: Logos = { ...(config.logos ?? {}) };
        // `key` is already allowlisted by isLogoKey above; re-deriving it from
        // LOGO_KEYS makes the value that indexes the object provably a constant
        // rather than request data (CodeQL js/remote-property-injection), and
        // Object.hasOwn avoids matching inherited properties such as
        // "constructor" that a truthiness check would treat as registered.
        const safeKey = LOGO_KEYS.find((k) => k === key);
        if (!safeKey || !Object.hasOwn(logosObj, safeKey)) {
          throw Object.assign(new Error("Logo key not registered"), {
            _status: 404,
          });
        }
        const existing = logosObj[safeKey]!;

        delete logosObj[safeKey];
        const nextConfig: BrandConfig = { ...config, logos: logosObj };
        delete nextConfig._source;
        await writeBrandJsonAtomic(brandJsonPath, nextConfig);

        // Best-effort file delete.
        try {
          const assetsDir = safeJoin(brandsDir(), safeSlug, "assets");
          const target = safeJoin(assetsDir, existing.file);
          await fsp.unlink(target);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== "ENOENT") {
            logAudit(
              req,
              "success",
              undefined,
              `logos.delete.fileCleanupFailed file=${existing.file}`,
            );
          }
        }

        logAudit(
          req,
          "success",
          200,
          `logos.deleted slug=${safeSlug} key=${key} file=${existing.file}`,
        );
        res.json({ ok: true, slug: safeSlug, key });
      });
    } catch (err) {
      const e = err as Error & { _status?: number };
      if (e._status === 404) {
        res.status(404).json({
          error: "Logo key not registered",
          slug: safeSlug,
          key,
        });
        logAudit(req, "denied", 404, `logo key unregistered: ${key}`);
        return;
      }
      res.status(500).json({
        error: "Failed to delete logo",
        details: sanitizeErrorMessage(e.message),
      });
      logAudit(req, "error", 500, "logos.delete failed");
    }
  },
);

/**
 * Static serving for `brands/<slug>/assets/<file>` via the `/brand-assets`
 * mount. REQ-063 + CISO F-STATIC-02 (sanitize-on-read).
 *
 * Mounted at `/brand-assets` in `server.ts`. Read-only — no auth.
 */
export const brandAssetsStaticRouter = Router();

brandAssetsStaticRouter.get(
  "/:slug/:file",
  async (req: Request, res: Response) => {
    const { slug, file } = req.params;

    // Express 5 types params as `string | string[]`; narrow both here.
    if (typeof slug !== "string" || typeof file !== "string") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    // Slug must match the canonical brand slug format.
    try {
      validateSlug(slug);
    } catch {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    // Filename allowlist — letters, digits, `.`, `-`, `_`. No path separators.
    if (!/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith(".")) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const ext = path.extname(file).toLowerCase();
    // `.svgz` is NOT allowed — the gzip wrapper would bypass our sanitizer.
    if (![".svg", ".png", ".jpg", ".jpeg"].includes(ext)) {
      res.status(404).json({ error: "asset not found", slug, file });
      return;
    }

    let assetPath: string;
    let assetsDir: string;
    try {
      assetsDir = safeJoin(brandsDir(), slug, "assets");
      assetPath = safeJoin(assetsDir, file);
    } catch {
      res.status(400).json({ error: "path traversal" });
      return;
    }

    // Defence in depth — both segments passed safeJoin, but verify the
    // resolved path sits within assets/.
    const resolvedDir = path.resolve(assetsDir);
    const resolvedPath = path.resolve(assetPath);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      res.status(400).json({ error: "path traversal" });
      return;
    }

    let bytes: Buffer;
    try {
      bytes = await fsp.readFile(resolvedPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        res.status(404).json({ error: "asset not found", slug, file });
        return;
      }
      res.status(500).json({
        error: "Failed to read asset",
        details: sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
        ),
      });
      return;
    }

    // CISO F-STATIC-02 — sanitize-on-read for SVG.
    if (ext === ".svg") {
      try {
        const sanitized = sanitizeSvg(bytes);
        if (sanitized.modified) {
          logAudit(
            req,
            "success",
            undefined,
            `assets.sanitize-on-read-mismatch slug=${slug} file=${file}`,
          );
        }
        bytes = Buffer.from(sanitized.output, "utf-8");
      } catch (err) {
        res.status(400).json({
          error: "invalid svg",
          details: sanitizeErrorMessage(
            err instanceof Error ? err.message : String(err),
          ),
        });
        return;
      }
    }

    const ct = mimeFromExt(ext);
    if (ct) res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(bytes);
  },
);

// ────────────────────────────────────────────────────────────────────────
// SPEC-004 insertion point — all new identity/logos routes are ABOVE here.
// When SPEC-002 guidelines routes land, they should go BELOW this marker.
// ────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────
// SPEC-002 — Brand guidelines (GET parsed | ?raw=1 markdown, PUT markdown)
// REQ-006, REQ-007, REQ-077, CISO F-GUIDE-01 (post-render sanitization).
// ────────────────────────────────────────────────────────────────────────

/** Maximum accepted guidelines.md size, REQ-006 operational bound. */
const MAX_GUIDELINES_BYTES = 100 * 1024;

/** Allowed MIME types for PUT /guidelines — text only. */
const ALLOWED_GUIDELINES_MIMES = new Set<string>([
  "text/markdown",
  "text/plain",
]);

/** Build the absolute path to a brand's guidelines.md file. */
function guidelinesPathFor(slug: string): string | null {
  try {
    return safeJoin(brandsDir(), slug, "guidelines.md");
  } catch {
    return null;
  }
}

/** Build the absolute path to a brand directory. */
function brandDirPath(slug: string): string | null {
  try {
    return safeJoin(brandsDir(), slug);
  } catch {
    return null;
  }
}

/**
 * GET /api/brands/:slug/guidelines
 *
 * Default response: parsed JSON (ParsedGuidelines shape). With `?raw=1`
 * or `?raw=true`, returns the raw Markdown body with
 * `Content-Type: text/markdown; charset=utf-8`.
 *
 * 404 shape: `{ error, slug }` — normalized per REQ-079.
 */
router.get(
  "/:slug/guidelines",
  publicAccess,
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      return;
    }

    let safeSlug: string;
    try {
      safeSlug = validateSlug(slug);
    } catch {
      res.status(400).json({ error: "Invalid slug parameter" });
      return;
    }

    // Brand existence check (REQ-079).
    const brand = getBySlug(safeSlug);
    if (!brand) {
      res.status(404).json({ error: "Brand not found", slug: safeSlug });
      return;
    }

    const filePath = guidelinesPathFor(safeSlug);
    if (!filePath) {
      res.status(400).json({ error: "Invalid slug parameter" });
      return;
    }

    let raw: string;
    try {
      raw = await fsp.readFile(filePath, "utf-8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        res.status(404).json({
          error: "guidelines.md not found for brand",
          slug: safeSlug,
        });
        return;
      }
      res.status(500).json({
        error: "Failed to read guidelines",
        details: sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
        ),
      });
      return;
    }

    // Raw-mode toggle — `?raw=1` or `?raw=true`. Any other value → parsed JSON.
    const rawParam =
      typeof req.query.raw === "string" ? req.query.raw : undefined;
    if (rawParam === "1" || rawParam === "true") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.send(raw);
      return;
    }

    try {
      const parsed = parseGuidelines(raw);
      res.json(parsed);
    } catch (err) {
      res.status(500).json({
        error: "Failed to parse guidelines",
        details: sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
        ),
      });
    }
  },
);

/**
 * Size-limited text body reader for PUT /guidelines. Enforces REQ-006's
 * 100 KB ceiling at the byte stream level — we reject with 413 as soon as
 * the cumulative byte count crosses the threshold, without buffering the
 * entire oversized payload.
 *
 * Returns the full body string on success; on failure, writes the error
 * response and resolves `null` (caller should just return).
 */
async function readGuidelinesBody(
  req: Request,
  res: Response,
): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let total = 0;
    const chunks: Buffer[] = [];
    let aborted = false;

    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      total += chunk.length;
      if (total > MAX_GUIDELINES_BYTES) {
        aborted = true;
        res.status(413).json({
          error: "Payload too large",
          maxBytes: MAX_GUIDELINES_BYTES,
        });
        logAudit(
          req,
          "denied",
          413,
          `guidelines.tooLarge bytes=${total}`,
        );
        resolve(null);
        // Drain and destroy — don't keep buffering.
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (aborted) return;
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    req.on("error", (err) => {
      if (aborted) return;
      aborted = true;
      res.status(400).json({
        error: "Failed to read request body",
        details: sanitizeErrorMessage(err.message),
      });
      resolve(null);
    });
  });
}

/**
 * PUT /api/brands/:slug/guidelines
 *
 * Accepts `text/markdown` or `text/plain` body (max 100 KB). Writes
 * atomically via temp-then-rename to `brands/<slug>/guidelines.md`.
 * Requires API key (gated by server-level middleware in production; the
 * integration-test harness enforces it explicitly).
 *
 * Error shapes:
 *   - 400 — invalid slug
 *   - 404 — unknown brand (`{error, slug}`) or missing brand directory
 *   - 413 — body exceeds `MAX_GUIDELINES_BYTES` (`{error, maxBytes}`)
 *   - 415 — unsupported Content-Type
 */
router.put(
  "/:slug/guidelines",
  requireApiKey,
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    if (!validateParam(slug)) {
      res.status(400).json({ error: "Invalid parameter: slug" });
      logAudit(req, "denied", 400, "invalid slug");
      return;
    }

    let safeSlug: string;
    try {
      safeSlug = validateSlug(slug);
    } catch {
      res.status(400).json({ error: "Invalid slug parameter" });
      logAudit(req, "denied", 400, "invalid slug format");
      return;
    }

    // MIME gate (REQ-006 — text payloads only).
    const rawContentType = req.headers["content-type"] ?? "";
    const mime = rawContentType.split(";")[0]!.trim().toLowerCase();
    if (!ALLOWED_GUIDELINES_MIMES.has(mime)) {
      res.status(415).json({
        error:
          "Unsupported Media Type — use text/markdown or text/plain",
      });
      logAudit(req, "denied", 415, `guidelines.mime rejected=${mime}`);
      return;
    }

    // Brand directory must exist on disk. Unlike GET, PUT uses the
    // filesystem as source of truth — the in-memory index may lag a new
    // directory that was just created. "Brand directory not found" is the
    // canonical error message for PUT (tests depend on the exact wording).
    const dir = brandDirPath(safeSlug);
    if (!dir) {
      res.status(400).json({ error: "Invalid slug parameter" });
      logAudit(req, "denied", 400, "safeJoin rejected slug");
      return;
    }
    try {
      const stat = await fsp.stat(dir);
      if (!stat.isDirectory()) {
        res
          .status(404)
          .json({ error: "Brand directory not found", slug: safeSlug });
        logAudit(req, "denied", 404, "brand dir missing");
        return;
      }
    } catch {
      res
        .status(404)
        .json({ error: "Brand directory not found", slug: safeSlug });
      logAudit(req, "denied", 404, "brand dir stat failed");
      return;
    }

    // Pull the body with streaming size enforcement.
    const body = await readGuidelinesBody(req, res);
    if (body === null) {
      // readGuidelinesBody already wrote the response (413 or 400).
      return;
    }

    const filePath = guidelinesPathFor(safeSlug);
    if (!filePath) {
      res.status(400).json({ error: "Invalid slug parameter" });
      logAudit(req, "denied", 400, "safeJoin rejected guidelines path");
      return;
    }

    // REQ-090 — serialise concurrent PUT /guidelines against the same slug
    // through the per-slug advisory lock. Logos upload/delete already use
    // this; guidelines was the missing member of the RMW set. Different
    // slugs still write in parallel. The tmp suffix mixes pid + ms-timestamp
    // + crypto randomness so even a rapid burst inside the lock cannot
    // collide on the filesystem.
    try {
      await withBrandLock(safeSlug, req, "guidelines.update", async () => {
        const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto
          .randomBytes(4)
          .toString("hex")}`;
        try {
          await fsp.writeFile(tmpPath, body, "utf-8");
          await fsp.rename(tmpPath, filePath);
        } catch (err) {
          // Best-effort temp cleanup.
          try {
            await fsp.unlink(tmpPath);
          } catch {
            /* ignore */
          }
          throw err;
        }
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: "Failed to write guidelines",
        details: sanitizeErrorMessage(errMsg),
      });
      logAudit(req, "error", 500, `guidelines.write failed: ${errMsg}`);
      return;
    }

    logAudit(
      req,
      "success",
      200,
      `guidelines.updated slug=${safeSlug} bytes=${body.length}`,
    );
    res.json({
      ok: true,
      slug: safeSlug,
      bytes: body.length,
    });
  },
);

export default router;
