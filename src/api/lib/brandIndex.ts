/**
 * Brand index — directory-aware loader.
 *
 * Supports two on-disk formats for each brand:
 *   1. Directory: `brands/<slug>/brand.json` (+ `guidelines.md`, `assets/`)
 *   2. Flat:     `brands/<slug>.json`
 *
 * When both exist for the same slug, the directory form wins and a warning
 * is logged. Both produce an equivalent `BrandConfig` in memory.
 *
 * Implements BRD REQ-001, REQ-002, REQ-003, REQ-051, REQ-053, REQ-054, REQ-064.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  BrandConfig,
  FlatColors,
  RoleGroupedColors,
  isRoleGroupedColors,
  extractPrimaryColor,
} from "../../../lib/types/brand";

// Re-export the shared types so existing importers (`../lib/brandIndex`)
// keep working without code changes.
export type {
  BrandConfig,
  FlatColors,
  RoleGroupedColors,
  ColorEntry,
  LogoEntry,
  Logos,
  Typography,
  TypographyGroup,
  TypographyScaleEntry,
} from "../../../lib/types/brand";
export { isRoleGroupedColors, extractPrimaryColor } from "../../../lib/types/brand";

// Back-compat shim: the old flat `BrandColors` interface. Many legacy
// callers (and tests) reference it. We expose it as the FlatColors alias.
export type BrandColors = FlatColors;

export interface BrandFonts {
  heading: string;
  body: string;
  mono?: string;
}

let brands: BrandConfig[] = [];
let watcher: fs.FSWatcher | null = null;

/**
 * Attempt to read & parse a JSON file. Returns undefined on any error.
 */
function safeReadJson<T = unknown>(filePath: string): T | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[brandIndex] Failed to read ${filePath}:`, err);
    return undefined;
  }
}

/**
 * Validate that an object looks like a BrandConfig (has name + slug).
 * Does NOT validate the colors shape — that is a union at runtime.
 */
function isValidBrand(obj: unknown): obj is BrandConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const b = obj as Partial<BrandConfig>;
  return typeof b.name === "string" && typeof b.slug === "string";
}

/**
 * Scan a brands directory and return the in-memory brand list.
 *
 * Algorithm:
 *   1. First pass: enumerate directories. For every `<dir>/brand.json`,
 *      load it and mark the slug as "claimed by directory".
 *   2. Second pass: enumerate `*.json` files at the top level. If the
 *      basename's slug is already claimed by a directory, skip the flat
 *      file (and warn). Otherwise, load the flat file.
 *   3. Sort by display name.
 */
function loadBrands(dir: string): BrandConfig[] {
  const loaded: BrandConfig[] = [];
  const claimedByDirectory = new Set<string>();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    console.warn(`[brandIndex] Could not read brands directory: ${dir}`);
    return loaded;
  }

  // Pass 1 — directories take precedence.
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const brandDir = path.join(dir, entry.name);
    const brandJsonPath = path.join(brandDir, "brand.json");
    if (!fs.existsSync(brandJsonPath)) {
      // Directory without brand.json — skip silently (could be an assets-
      // only holdover).
      continue;
    }
    const parsed = safeReadJson<BrandConfig>(brandJsonPath);
    if (!parsed || !isValidBrand(parsed)) {
      console.warn(
        `[brandIndex] Skipping directory brand at ${brandJsonPath}: invalid schema`,
      );
      continue;
    }
    // Trust the on-disk slug, but warn if the directory name diverges.
    if (parsed.slug !== entry.name) {
      console.warn(
        `[brandIndex] Directory "${entry.name}" contains brand with slug "${parsed.slug}" — using slug from brand.json`,
      );
    }
    parsed._source = "directory";
    claimedByDirectory.add(parsed.slug);
    // Also claim the directory name itself, since a flat `<name>.json` would
    // collide with this directory even if the inner slug differs.
    claimedByDirectory.add(entry.name);
    loaded.push(parsed);
  }

  // Pass 2 — flat .json files, skipping any slug already claimed.
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const basename = entry.name.slice(0, -".json".length);
    if (claimedByDirectory.has(basename)) {
      console.warn(
        `[brandIndex] Both brands/${basename}/ and brands/${entry.name} exist — directory wins, ignoring flat file`,
      );
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const parsed = safeReadJson<BrandConfig>(fullPath);
    if (!parsed || !isValidBrand(parsed)) {
      console.warn(
        `[brandIndex] Skipping flat brand ${fullPath}: invalid schema`,
      );
      continue;
    }
    parsed._source = "flat";
    loaded.push(parsed);
  }

  return loaded.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Build the brand index from a directory. Sets up a filesystem watcher so
 * the index rebuilds when brand files change.
 *
 * Watches recursively where supported (darwin + win32). On linux, the
 * non-recursive watch on the top-level directory still catches flat-file
 * changes and directory creation; directory-internal edits will be picked
 * up on next server restart.
 */
export function buildBrandIndex(dir: string): void {
  const resolvedDir = path.resolve(dir);
  brands = loadBrands(resolvedDir);
  console.log(
    `[brandIndex] Indexed ${brands.length} brands from ${resolvedDir}`,
  );

  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const canRecursive = process.platform === "darwin" || process.platform === "win32";

  try {
    watcher = fs.watch(
      resolvedDir,
      canRecursive ? { recursive: true } : undefined,
      (_eventType, filename) => {
        if (!filename) return;
        // Trigger rebuild for any .json or brand.json change, and for
        // directory creations (filename without extension).
        const isJson = filename.endsWith(".json");
        const isBrandJson = filename.endsWith("brand.json");
        const looksLikeDir = !filename.includes(".");
        if (!isJson && !isBrandJson && !looksLikeDir) return;
        console.log(
          `[brandIndex] Detected change in ${filename}, rebuilding index...`,
        );
        brands = loadBrands(resolvedDir);
        console.log(`[brandIndex] Re-indexed ${brands.length} brands`);
      },
    );
  } catch (err) {
    console.warn(
      `[brandIndex] Could not set up file watcher for ${resolvedDir}:`,
      err,
    );
  }
}

/** Returns all brands with summary info (name, slug, description, primaryColor). */
export function getAll(): Array<{
  name: string;
  slug: string;
  description: string;
  primaryColor: string;
}> {
  return brands.map((b) => ({
    name: b.name,
    slug: b.slug,
    description: b.description ?? "",
    primaryColor: extractPrimaryColor(b.colors),
  }));
}

/** Returns a full brand config by slug. */
export function getBySlug(slug: string): BrandConfig | undefined {
  return brands.find((b) => b.slug === slug);
}

/**
 * Returns the brand's colors in whatever shape they are stored.
 * Callers must detect the shape via `isRoleGroupedColors`.
 */
export function getBrandColors(
  slug: string,
): BrandConfig["colors"] | undefined {
  return getBySlug(slug)?.colors;
}

/** Returns the brand's font config. */
export function getBrandFonts(slug: string): BrandFonts | undefined {
  return getBySlug(slug)?.fonts;
}

/**
 * Font stack helper — wraps a single family name in quotes and appends a
 * generic fallback based on naming heuristics.
 */
function fontFallback(font: string): string {
  if (font.includes("system-ui") || font.includes(",")) {
    return font;
  }
  if (font.toLowerCase().includes("mono") || font.toLowerCase().includes("code")) {
    return `'${font}', monospace`;
  }
  return `'${font}', sans-serif`;
}

/**
 * Serialise a `rgb` array like `[0, 87, 184]` into a CSS-ready
 * `"0, 87, 184"` string. Defensive against missing/invalid data.
 */
function rgbToCss(rgb: unknown): string | undefined {
  if (!Array.isArray(rgb) || rgb.length !== 3) return undefined;
  const [r, g, b] = rgb;
  if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
    return undefined;
  }
  return `${r}, ${g}, ${b}`;
}

/**
 * CSS key-safe version of a raw role/name.
 *
 * Preserves camelCase → kebab-case conversion (e.g., `textMuted` →
 * `text-muted`, matching pre-existing `--brand-text-muted` consumers),
 * then lowercases, replaces disallowed characters with `-`, collapses
 * repeats, and trims hyphens from the ends.
 */
function cssSafe(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Emit CSS custom properties for a brand. Handles both flat and role-grouped
 * color shapes.
 *
 *   Flat    → `--brand-primary`, `--brand-secondary`, …
 *   Grouped → `--color-primary-blue`, `--color-primary-blue-rgb`, …
 *             Fonts/borders/shadows still use the `--brand-*` prefix.
 */
export function generateCssVariables(slug: string): string | undefined {
  const brand = getBySlug(slug);
  if (!brand) return undefined;

  const lines: string[] = [`:root {`];

  // ─── Colors ────────────────────────────────────────────────────
  if (isRoleGroupedColors(brand.colors)) {
    const groups: RoleGroupedColors = brand.colors;
    for (const [groupName, groupValue] of Object.entries(groups)) {
      if (!groupValue || typeof groupValue !== "object") continue;
      const entries = groupValue as Record<string, { hex?: unknown; rgb?: unknown }>;
      for (const [colorName, entry] of Object.entries(entries)) {
        if (!entry || typeof entry !== "object") continue;
        const keyBase = `--color-${cssSafe(groupName)}-${cssSafe(colorName)}`;
        if (typeof entry.hex === "string") {
          lines.push(`  ${keyBase}: ${entry.hex};`);
        }
        const rgbStr = rgbToCss(entry.rgb);
        if (rgbStr) {
          lines.push(`  ${keyBase}-rgb: ${rgbStr};`);
        }
      }
    }
  } else {
    const flat = brand.colors as FlatColors;
    // Legacy alias map — keeps `--brand-bg` in addition to `--brand-background`
    // for templates relying on the pre-expansion variable names.
    const legacyAliases: Record<string, string> = {
      background: "bg",
    };
    for (const [name, value] of Object.entries(flat)) {
      if (typeof value !== "string") continue;
      const kebab = cssSafe(name);
      lines.push(`  --brand-${kebab}: ${value};`);
      const alias = legacyAliases[name];
      if (alias) {
        lines.push(`  --brand-${alias}: ${value};`);
      }
    }
  }

  // ─── Fonts ─────────────────────────────────────────────────────
  if (brand.fonts) {
    if (typeof brand.fonts.heading === "string") {
      lines.push(`  --brand-font-heading: ${fontFallback(brand.fonts.heading)};`);
    }
    if (typeof brand.fonts.body === "string") {
      lines.push(`  --brand-font-body: ${fontFallback(brand.fonts.body)};`);
    }
    if (typeof brand.fonts.mono === "string") {
      lines.push(`  --brand-font-mono: ${fontFallback(brand.fonts.mono)};`);
    }
  }

  // ─── Border radius ─────────────────────────────────────────────
  if (brand.borderRadius) {
    lines.push(`  --brand-radius-sm: ${brand.borderRadius.small};`);
    lines.push(`  --brand-radius-md: ${brand.borderRadius.medium};`);
    lines.push(`  --brand-radius-lg: ${brand.borderRadius.large};`);
    lines.push(`  --brand-radius-full: ${brand.borderRadius.full};`);
  }

  // ─── Shadows ───────────────────────────────────────────────────
  if (brand.shadows) {
    lines.push(`  --brand-shadow-sm: ${brand.shadows.small};`);
    lines.push(`  --brand-shadow-md: ${brand.shadows.medium};`);
    lines.push(`  --brand-shadow-lg: ${brand.shadows.large};`);
  }

  // ─── Spacing ───────────────────────────────────────────────────
  if (brand.spacing && typeof brand.spacing.unit === "number") {
    lines.push(`  --brand-spacing-unit: ${brand.spacing.unit}px;`);
  }

  lines.push(`}`);
  return lines.join("\n");
}

/**
 * List files in a brand's `assets/` directory (directory-format brands only).
 * Returns an empty array for flat brands or on any read error.
 */
export function getBrandAssetFiles(
  brandsDir: string,
  slug: string,
): string[] {
  const brand = getBySlug(slug);
  if (!brand || brand._source !== "directory") return [];
  const assetsDir = path.join(path.resolve(brandsDir), slug, "assets");
  try {
    const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

/** Test helper — force-rebuild the index without setting up a watcher. */
export function _rebuildForTest(dir: string): void {
  brands = loadBrands(path.resolve(dir));
}

/**
 * Close the active filesystem watcher, if any. Safe to call multiple times.
 * Primarily used by tests to prevent the watcher from firing after teardown.
 */
export function closeWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
