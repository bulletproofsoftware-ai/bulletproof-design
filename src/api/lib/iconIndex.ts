/**
 * In-memory Material Symbols icon index.
 *
 * Loads `icons/material-symbols/metadata.json` at startup and exposes
 * search, lookup, and category helpers consumed by the /api/icons routes.
 *
 * Pattern mirrors templateIndex.ts and brandIndex.ts but returns an
 * instance object (per spec) so tests and routes can hold concrete references.
 */

import * as fs from "fs";
import * as path from "path";

export type IconStyle = "outlined" | "rounded" | "sharp";
export const ICON_STYLES: readonly IconStyle[] = ["outlined", "rounded", "sharp"] as const;
export const DEFAULT_ICON_STYLE: IconStyle = "outlined";

export interface IconMetadata {
  name: string;
  category: string;
  tags: string[];
  aliases: string[];
  styles: IconStyle[];
}

export interface IconSearchResult {
  icon: IconMetadata;
  score: number;
}

export interface IconSearchOptions {
  q?: string;
  style?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface IconSearchResponse {
  items: IconMetadata[];
  total: number;
  page: number;
  limit: number;
}

export interface IconIndex {
  /** Root directory containing style subdirs and metadata.json */
  readonly rootDir: string;
  /** Total count of indexed icons (0 when empty/missing) */
  readonly size: number;
  all(): IconMetadata[];
  get(name: string): IconMetadata | undefined;
  search(opts: IconSearchOptions): IconSearchResponse;
  categories(): { category: string; count: number }[];
  hasStyle(name: string, style: string): boolean;
  svgPath(name: string, style?: string): string | undefined;
  reload(): Promise<void>;
}

/** Pagination defaults / clamps (matches spec). */
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

/** Default root if none provided (relative to cwd). */
const DEFAULT_ICONS_ROOT = "icons/material-symbols";

/** Module-level singleton populated by `loadIconIndex`. Used by route handlers. */
let currentIndex: IconIndex | null = null;

/**
 * Returns the active icon index, or `undefined` if none has been loaded yet.
 * Routes should treat `undefined` as "feature disabled / directory missing".
 */
export function getIconIndex(): IconIndex | undefined {
  return currentIndex ?? undefined;
}

/**
 * Sets the active icon index (used by server.ts and tests).
 */
export function setIconIndex(index: IconIndex | null): void {
  currentIndex = index;
}

/**
 * Loads the icon index from `<rootDir>/metadata.json`.
 *
 * - Missing directory or file → empty index with a console warning.
 *   (Fail-open per SPEC-003: the server should still boot when icons haven't
 *   been synced yet.)
 * - Invalid JSON or schema → throws. Caller decides whether to abort startup.
 */
export async function loadIconIndex(rootDir?: string): Promise<IconIndex> {
  const resolvedRoot = path.resolve(rootDir ?? DEFAULT_ICONS_ROOT);
  const index = buildIndex(resolvedRoot);
  currentIndex = index;
  return index;
}

/**
 * Validates the icon-name slug used in routes.
 * Accepts only `^[a-z0-9_]+$` (matching metadata.schema.json pattern).
 */
export function isValidIconName(name: string): boolean {
  return typeof name === "string" && /^[a-z0-9_]+$/.test(name) && name.length <= 128;
}

/**
 * Validates an icon style against the fixed enum.
 */
export function isValidIconStyle(style: unknown): style is IconStyle {
  return typeof style === "string" && (ICON_STYLES as readonly string[]).includes(style);
}

/** Internal: build a read-only index object from the filesystem. */
function buildIndex(resolvedRoot: string): IconIndex {
  const { icons, warning } = loadMetadata(resolvedRoot);
  if (warning) {
    console.warn(`[iconIndex] ${warning}`);
  }

  // Primary lookup by exact name.
  const byName = new Map<string, IconMetadata>();
  // Secondary lookup by lowercase alias / tag token → set of names.
  const byAlias = new Map<string, Set<string>>();
  const byTag = new Map<string, Set<string>>();
  // Category → set of names (for category filter + counts).
  const byCategory = new Map<string, Set<string>>();

  for (const icon of icons) {
    byName.set(icon.name, icon);

    const categorySet = byCategory.get(icon.category) ?? new Set<string>();
    categorySet.add(icon.name);
    byCategory.set(icon.category, categorySet);

    for (const alias of icon.aliases) {
      const key = alias.toLowerCase();
      const set = byAlias.get(key) ?? new Set<string>();
      set.add(icon.name);
      byAlias.set(key, set);
    }
    for (const tag of icon.tags) {
      const key = tag.toLowerCase();
      const set = byTag.get(key) ?? new Set<string>();
      set.add(icon.name);
      byTag.set(key, set);
    }
  }

  console.log(
    `[iconIndex] Indexed ${icons.length} icons from ${path.join(resolvedRoot, "metadata.json")}`,
  );

  const index: IconIndex = {
    rootDir: resolvedRoot,
    get size() {
      return icons.length;
    },
    all: () => icons.slice(),
    get: (name: string) => byName.get(name),
    hasStyle: (name: string, style: string) => {
      const icon = byName.get(name);
      if (!icon) return false;
      if (!isValidIconStyle(style)) return false;
      return icon.styles.includes(style);
    },
    svgPath: (name: string, style?: string): string | undefined => {
      if (!isValidIconName(name)) return undefined;
      const resolvedStyle: IconStyle = isValidIconStyle(style) ? style : DEFAULT_ICON_STYLE;
      const icon = byName.get(name);
      if (!icon || !icon.styles.includes(resolvedStyle)) return undefined;
      // Build and re-resolve the path, then assert containment under rootDir.
      const filename = `${name}.svg`;
      const candidate = path.resolve(resolvedRoot, resolvedStyle, filename);
      if (!isUnderRoot(candidate, resolvedRoot)) return undefined;
      return candidate;
    },
    categories: () => {
      const out: { category: string; count: number }[] = [];
      for (const [category, nameSet] of byCategory.entries()) {
        out.push({ category, count: nameSet.size });
      }
      out.sort((a, b) => a.category.localeCompare(b.category));
      return out;
    },
    search: (opts: IconSearchOptions): IconSearchResponse => {
      const q = (opts.q ?? "").trim().toLowerCase();
      const styleFilter = opts.style;
      const categoryFilter = opts.category;

      // Collect candidates by query (or all when empty).
      let candidates: IconMetadata[];
      if (!q) {
        candidates = icons.slice();
      } else {
        // Substring search across name, aliases, tags. Score prioritises
        // exact-name matches, then prefix matches, then contains.
        const scored: IconSearchResult[] = [];
        for (const icon of icons) {
          const score = scoreIcon(icon, q);
          if (score > 0) scored.push({ icon, score });
        }
        scored.sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name));
        candidates = scored.map((s) => s.icon);
      }

      // Apply exact-match filters.
      if (categoryFilter) {
        candidates = candidates.filter((i) => i.category === categoryFilter);
      }
      if (styleFilter) {
        if (!isValidIconStyle(styleFilter)) {
          // Unknown style → empty result set (keeps shape stable for callers).
          candidates = [];
        } else {
          candidates = candidates.filter((i) => i.styles.includes(styleFilter));
        }
      }

      const total = candidates.length;
      // Pagination: spec-defined `limit=0` sentinel returns full set on page 1.
      const requestedLimit = opts.limit;
      if (requestedLimit === 0) {
        return {
          items: candidates,
          total,
          page: 1,
          limit: total,
        };
      }

      const limit = clampLimit(requestedLimit);
      const page = Math.max(1, Math.floor(opts.page ?? 1));
      const start = (page - 1) * limit;
      const end = start + limit;
      const items = candidates.slice(start, end);
      return { items, total, page, limit };
    },
    reload: async () => {
      // Rebuild from disk. Replaces the live mutable references in-place.
      const rebuilt = buildIndex(resolvedRoot);
      // Copy internal state onto this instance.
      (index as { rootDir: string }).rootDir = rebuilt.rootDir;
      // Replace icons array reference.
      icons.length = 0;
      icons.push(...rebuilt.all());
      byName.clear();
      for (const icon of icons) byName.set(icon.name, icon);
      byAlias.clear();
      byTag.clear();
      byCategory.clear();
      for (const icon of icons) {
        const categorySet = byCategory.get(icon.category) ?? new Set<string>();
        categorySet.add(icon.name);
        byCategory.set(icon.category, categorySet);
        for (const alias of icon.aliases) {
          const key = alias.toLowerCase();
          const set = byAlias.get(key) ?? new Set<string>();
          set.add(icon.name);
          byAlias.set(key, set);
        }
        for (const tag of icon.tags) {
          const key = tag.toLowerCase();
          const set = byTag.get(key) ?? new Set<string>();
          set.add(icon.name);
          byTag.set(key, set);
        }
      }
      currentIndex = index;
    },
  };

  return index;
}

interface LoadResult {
  icons: IconMetadata[];
  warning?: string;
}

function loadMetadata(resolvedRoot: string): LoadResult {
  const metadataPath = path.join(resolvedRoot, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return {
      icons: [],
      warning: `metadata.json not found at ${metadataPath} — serving empty icon index (run 'npm run icons:sync')`,
    };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(metadataPath, "utf-8");
  } catch (err) {
    return {
      icons: [],
      warning: `failed to read metadata.json: ${(err as Error).message}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[iconIndex] metadata.json is not valid JSON: ${(err as Error).message}`,
      { cause: err },
    );
  }
  if (!isParsedMetadata(parsed)) {
    throw new Error(
      "[iconIndex] metadata.json does not match expected shape: { version, source, generated, icons[] }",
    );
  }
  // Defensive runtime validation of each entry (schema validation happens in sync script).
  const icons: IconMetadata[] = [];
  for (const entry of parsed.icons) {
    if (!isIconMetadata(entry)) continue;
    icons.push({
      name: entry.name,
      category: entry.category,
      tags: [...entry.tags],
      aliases: [...entry.aliases],
      styles: [...entry.styles],
    });
  }
  return { icons };
}

interface ParsedMetadata {
  version: string;
  source: string;
  generated: string;
  icons: unknown[];
}

function isParsedMetadata(v: unknown): v is ParsedMetadata {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.version === "string"
    && typeof r.source === "string"
    && typeof r.generated === "string"
    && Array.isArray(r.icons)
  );
}

function isIconMetadata(v: unknown): v is IconMetadata {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== "string" || !/^[a-z0-9_]+$/.test(r.name)) return false;
  if (typeof r.category !== "string" || r.category.length === 0) return false;
  if (!Array.isArray(r.tags) || !r.tags.every((t) => typeof t === "string")) return false;
  if (!Array.isArray(r.aliases) || r.aliases.length === 0 || !r.aliases.every((a) => typeof a === "string")) return false;
  if (!Array.isArray(r.styles) || r.styles.length === 0) return false;
  for (const s of r.styles) {
    if (s !== "outlined" && s !== "rounded" && s !== "sharp") return false;
  }
  return true;
}

/**
 * Scores an icon against a lowercase query.
 * Higher is better. Returns 0 when no field matches.
 */
function scoreIcon(icon: IconMetadata, q: string): number {
  const name = icon.name.toLowerCase();
  if (name === q) return 1000;
  if (name.startsWith(q)) return 500;
  if (name.includes(q)) return 200;

  // Alias matches.
  for (const alias of icon.aliases) {
    const a = alias.toLowerCase();
    if (a === q) return 300;
    if (a.includes(q)) return 150;
  }
  // Tag matches.
  for (const tag of icon.tags) {
    const t = tag.toLowerCase();
    if (t === q) return 120;
    if (t.includes(q)) return 60;
  }
  // Category as a last-resort field.
  if (icon.category.toLowerCase().includes(q)) return 40;
  return 0;
}

function clampLimit(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_LIMIT;
  const n = Math.floor(value);
  if (n < MIN_LIMIT) return MIN_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

/** Ensure a resolved path stays within the given root. */
function isUnderRoot(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
