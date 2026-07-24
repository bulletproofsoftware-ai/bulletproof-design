/**
 * /api/icons — read-only Material Symbols routes.
 *
 * SPEC-003 (REQ-040/041/042/043):
 *   GET /api/icons                 → paginated list with q/style/category filters
 *   GET /api/icons/categories      → [{category, count}]
 *   GET /api/icons/:name           → icon metadata + availableStyles
 *   GET /api/icons/:name/svg       → raw SVG file content (text/svg)
 *
 * All 404 responses follow the normalized shape `{ error, name?, style? }`
 * per REQ-079.
 */

import { Router, Request, Response } from "express";
import * as fs from "fs";
import {
  getIconIndex,
  isValidIconName,
  isValidIconStyle,
  DEFAULT_ICON_STYLE,
  ICON_STYLES,
  type IconStyle,
} from "../lib/iconIndex";
import { publicAccess } from "../middleware/auth";

const router = Router();

/** Max-length guard for the optional `q` query string. */
const MAX_QUERY_LENGTH = 200;

/** Max-length guard for `category` query string. */
const MAX_CATEGORY_LENGTH = 64;

/**
 * Parse a numeric query param. Returns `undefined` when missing/invalid.
 * Rejects floats, negatives (except limit=0 sentinel handled separately),
 * and anything that isn't a finite integer.
 */
function parseIntParam(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  if (!/^-?\d+$/.test(raw)) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Validates a freeform query string for safety:
 *   - length bounded
 *   - no control characters (including NUL)
 */
function isSafeQuery(value: string, max: number): boolean {
  if (value.length > max) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(value)) return false;
  return true;
}

/**
 * GET /api/icons
 *
 * Query params:
 *   - q        optional substring (searched against name, aliases, tags)
 *   - style    one of "outlined" | "rounded" | "sharp"
 *   - category exact category match
 *   - page     1-based page number (default 1)
 *   - limit    results per page. Clamped 1..100 for external callers.
 *              Sentinel `limit=0` returns the full filtered set on page 1
 *              (used by the first-party /icons UI page for client-side
 *              virtualization). Documented in SPEC-003.
 */
router.get("/", publicAccess, (req: Request, res: Response) => {
  const index = getIconIndex();
  if (!index) {
    // Feature disabled or metadata missing — return an empty, well-formed page.
    res.json({ items: [], total: 0, page: 1, limit: 0 });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  if (q !== undefined && !isSafeQuery(q, MAX_QUERY_LENGTH)) {
    res.status(400).json({ error: "Invalid query parameter: q" });
    return;
  }

  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  if (category !== undefined && !isSafeQuery(category, MAX_CATEGORY_LENGTH)) {
    res.status(400).json({ error: "Invalid query parameter: category" });
    return;
  }

  const style = typeof req.query.style === "string" ? req.query.style : undefined;
  if (style !== undefined && !isValidIconStyle(style)) {
    res.status(400).json({
      error: "Invalid query parameter: style",
      allowed: ICON_STYLES,
    });
    return;
  }

  const page = parseIntParam(req.query.page);
  if (req.query.page !== undefined && (page === undefined || page < 1)) {
    res.status(400).json({ error: "Invalid query parameter: page (must be a positive integer)" });
    return;
  }

  const limit = parseIntParam(req.query.limit);
  if (req.query.limit !== undefined && (limit === undefined || limit < 0)) {
    res.status(400).json({ error: "Invalid query parameter: limit (must be >= 0; 0 = all)" });
    return;
  }

  const result = index.search({
    q,
    style,
    category,
    page,
    limit,
  });

  res.json(result);
});

/**
 * GET /api/icons/categories
 *
 * Returns every category that appears in metadata.json together with its
 * icon count, sorted alphabetically.
 */
router.get("/categories", publicAccess, (_req: Request, res: Response) => {
  const index = getIconIndex();
  if (!index) {
    res.json({ categories: [] });
    return;
  }
  res.json({ categories: index.categories() });
});

/**
 * GET /api/icons/:name
 *
 * Returns the icon's metadata plus the list of style variants that are
 * actually on disk (availableStyles). 404 when unknown.
 */
router.get("/:name", publicAccess, (req: Request, res: Response) => {
  const name = typeof req.params.name === "string" ? req.params.name : "";
  if (!isValidIconName(name)) {
    res.status(400).json({ error: "Invalid parameter: name" });
    return;
  }

  const index = getIconIndex();
  const icon = index?.get(name);
  if (!index || !icon) {
    res.status(404).json({ error: "Icon not found", name });
    return;
  }

  // availableStyles = styles declared in metadata AND with a file on disk.
  const availableStyles = icon.styles.filter((style): style is IconStyle => {
    const p = index.svgPath(name, style);
    return typeof p === "string" && safeStatSize(p) > 0;
  });

  res.json({
    ...icon,
    availableStyles,
  });
});

/**
 * GET /api/icons/:name/svg?style=outlined|rounded|sharp
 *
 * Streams the raw SVG file. Defaults to `outlined`.
 *
 * Security:
 *   - :name validated against /^[a-z0-9_]+$/
 *   - style validated against the fixed enum
 *   - resolved path asserted to stay under the icons root (iconIndex.svgPath
 *     returns undefined for any path that escapes)
 *   - response is a pre-existing file from the local volume; we never render
 *     user-controlled SVG
 *   - defensive content check rejects files containing <script> or
 *     inline `on*=` event-handler attributes at response time
 */
router.get("/:name/svg", publicAccess, (req: Request, res: Response) => {
  const name = typeof req.params.name === "string" ? req.params.name : "";
  if (!isValidIconName(name)) {
    res.status(400).json({ error: "Invalid parameter: name" });
    return;
  }

  const requestedStyle = typeof req.query.style === "string" ? req.query.style : undefined;
  if (requestedStyle !== undefined && !isValidIconStyle(requestedStyle)) {
    res.status(400).json({
      error: "Invalid query parameter: style",
      allowed: ICON_STYLES,
    });
    return;
  }
  const style: IconStyle = requestedStyle ?? DEFAULT_ICON_STYLE;

  const index = getIconIndex();
  const icon = index?.get(name);
  if (!index || !icon) {
    res.status(404).json({ error: "Icon not found", name });
    return;
  }
  if (!icon.styles.includes(style)) {
    res.status(404).json({ error: "Style not available", name, style });
    return;
  }

  const svgPath = index.svgPath(name, style);
  if (!svgPath) {
    // Path resolved outside root or other sanity failure.
    res.status(404).json({ error: "Style not available", name, style });
    return;
  }

  let svg: string;
  try {
    svg = fs.readFileSync(svgPath, "utf-8");
  } catch {
    res.status(404).json({ error: "Style not available", name, style });
    return;
  }

  if (containsDangerousSvgContent(svg)) {
    console.warn(`[icons] Refusing to serve SVG with dangerous content: ${name}.svg (${style})`);
    res.status(500).json({ error: "Icon asset failed safety check", name, style });
    return;
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(svg);
});

/** Returns file size, or 0 when stat fails. */
function safeStatSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/**
 * Conservative check for dangerous SVG content. Material Symbols SVGs
 * contain only `<svg>` / `<path>` / `<g>` — they have no scripts or
 * event handlers. Any occurrence of those patterns indicates tampering.
 */
function containsDangerousSvgContent(svg: string): boolean {
  const lowered = svg.toLowerCase();
  if (lowered.includes("<script")) return true;
  // Inline event-handler attributes like onclick=, onload=, onerror=, onmouseover=
  if (/\son[a-z]+\s*=/i.test(svg)) return true;
  // External-ref iframes/foreignObject shouldn't appear in Material Symbols.
  if (lowered.includes("<foreignobject")) return true;
  if (lowered.includes("<iframe")) return true;
  // `javascript:` URL schemes inside xlink:href / href attrs.
  if (/\b(?:xlink:)?href\s*=\s*["']?\s*javascript:/i.test(svg)) return true;
  return false;
}

export default router;
