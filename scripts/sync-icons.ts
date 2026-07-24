#!/usr/bin/env tsx
/**
 * scripts/sync-icons.ts
 *
 * Fetches Material Symbols icons from the google/material-design-icons GitHub
 * repository into icons/material-symbols/{outlined,rounded,sharp} and writes
 * a schema-validated metadata.json.
 *
 * Implements SPEC-003 (REQ-026 / REQ-075 / REQ-076):
 *   - GitHub Contents API enumeration of symbols/web/<icon>/
 *   - Per-icon metadata.json fetched when present (category/tags/aliases)
 *   - Deterministic name-prefix category fallback (category-map.json)
 *   - Fails loudly when categorization is impossible — no "uncategorized"
 *   - Concurrent downloads with exponential backoff on 429/403 rate limits
 *   - Resumable: skips existing non-empty SVG files
 *   - Atomic metadata.json write after Ajv schema validation
 *   - --dry-run / --limit / --styles / --concurrency flags
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx npm run icons:sync
 *   npm run icons:sync -- --dry-run --limit=25
 *   npm run icons:sync -- --styles=outlined --concurrency=16
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Ajv2020Module, { type ErrorObject } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import pLimit from "p-limit";

// Schema is draft-2020-12, so we use Ajv2020 (the base Ajv class targets draft-07).
// Both ajv and ajv-formats ship CJS defaults; unwrap the `.default` shim when present.
const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ?? Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ?? addFormatsModule;

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type IconStyle = "outlined" | "rounded" | "sharp";
const ALL_STYLES: readonly IconStyle[] = ["outlined", "rounded", "sharp"] as const;

interface SyncOptions {
  styles: IconStyle[];
  concurrency: number;
  dryRun: boolean;
  limit: number | undefined;
  rootDir: string;
  token: string | undefined;
}

interface IconRecord {
  name: string;
  category: string;
  tags: string[];
  aliases: string[];
  styles: IconStyle[];
}

interface UpstreamIconMeta {
  name: string;
  category?: string;
  tags?: string[];
  availableStyles: Set<IconStyle>;
}

interface CategoryMapFile {
  prefixes: Record<string, string>;
}

interface MetadataFile {
  version: string;
  source: "google/material-design-icons";
  generated: string;
  icons: IconRecord[];
}

const GITHUB_API_BASE = "https://api.github.com/repos/google/material-design-icons";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/google/material-design-icons";
const SYMBOLS_PATH = "symbols/web";
const DEFAULT_BRANCH = "master";
const METADATA_VERSION = "1.0.0";

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
const MAX_FAILURE_RATIO = 0.05;

// Filename on disk within each style subdir: <icon_name>.svg
// Upstream filename is <icon_name>_24px.svg inside materialsymbolsoutlined/rounded/sharp.
const STYLE_DIR_MAP: Record<IconStyle, string> = {
  outlined: "materialsymbolsoutlined",
  rounded: "materialsymbolsrounded",
  sharp: "materialsymbolssharp",
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): SyncOptions {
  const opts: SyncOptions = {
    styles: [...ALL_STYLES],
    concurrency: 8,
    dryRun: false,
    limit: undefined,
    rootDir: path.resolve("icons/material-symbols"),
    token: process.env.GITHUB_TOKEN || undefined,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg.startsWith("--styles=")) {
      const value = arg.slice("--styles=".length);
      const requested = value.split(",").map((s) => s.trim()).filter(Boolean);
      const validated: IconStyle[] = [];
      for (const s of requested) {
        if (!(ALL_STYLES as readonly string[]).includes(s)) {
          throw new Error(`Unknown --styles value: ${s}. Allowed: ${ALL_STYLES.join(",")}`);
        }
        validated.push(s as IconStyle);
      }
      if (validated.length === 0) {
        throw new Error("--styles must contain at least one style");
      }
      opts.styles = validated;
    } else if (arg.startsWith("--concurrency=")) {
      const n = Number.parseInt(arg.slice("--concurrency=".length), 10);
      if (!Number.isFinite(n) || n < 1 || n > 64) {
        throw new Error("--concurrency must be an integer between 1 and 64");
      }
      opts.concurrency = n;
    } else if (arg.startsWith("--limit=")) {
      const n = Number.parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error("--limit must be a positive integer");
      }
      opts.limit = n;
    } else if (arg.startsWith("--root=")) {
      opts.rootDir = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(
    [
      "Usage: tsx scripts/sync-icons.ts [options]",
      "",
      "Options:",
      "  --styles=outlined,rounded,sharp   Comma-separated list of styles (default: all)",
      "  --concurrency=N                   Concurrent HTTP requests (default: 8, max 64)",
      "  --dry-run                         Print planned ops, don't write anything",
      "  --limit=N                         Limit to first N icons (for testing)",
      "  --root=path                       Output directory (default: icons/material-symbols)",
      "",
      "Environment:",
      "  GITHUB_TOKEN  optional; recommended to avoid 60 req/hr unauth rate limit",
    ].join("\n"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP with backoff
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOpts {
  token?: string;
  accept?: string;
  retries?: number;
}

async function fetchWithBackoff(url: string, opts: FetchOpts = {}): Promise<Response> {
  const maxRetries = opts.retries ?? MAX_RETRIES;
  let backoff = INITIAL_BACKOFF_MS;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "design-library-icons-sync",
        Accept: opts.accept ?? "application/vnd.github+json",
      };
      if (opts.token) {
        headers.Authorization = `Bearer ${opts.token}`;
      }
      const res = await fetch(url, { headers });

      // Rate-limited — look at Retry-After or X-RateLimit-Reset, then back off.
      if (res.status === 429 || (res.status === 403 && isRateLimited(res))) {
        if (attempt === maxRetries) {
          throw new Error(`Rate-limited after ${maxRetries} retries on ${url}`);
        }
        const retryAfter = parseRetryAfter(res);
        const wait = retryAfter ?? backoff;
        console.warn(
          `[sync-icons] Rate-limited (${res.status}) on ${url} — retry ${attempt + 1}/${maxRetries} in ${wait}ms`,
        );
        await sleep(wait);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        continue;
      }

      // Transient server errors — retry with backoff.
      if (res.status >= 500 && res.status < 600) {
        if (attempt === maxRetries) {
          throw new Error(`Server error ${res.status} after ${maxRetries} retries on ${url}`);
        }
        console.warn(
          `[sync-icons] Server ${res.status} on ${url} — retry ${attempt + 1}/${maxRetries} in ${backoff}ms`,
        );
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt === maxRetries) break;
      console.warn(
        `[sync-icons] Network error on ${url} (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}`,
      );
      await sleep(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  }
  throw lastError ?? new Error(`fetch failed for ${url}`);
}

function isRateLimited(res: Response): boolean {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining && Number.parseInt(remaining, 10) === 0) return true;
  const msg = res.headers.get("x-ratelimit-used");
  return !!msg;
}

function parseRetryAfter(res: Response): number | undefined {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  const reset = res.headers.get("x-ratelimit-reset");
  if (reset) {
    const resetTs = Number.parseInt(reset, 10);
    if (Number.isFinite(resetTs)) {
      const waitMs = resetTs * 1000 - Date.now();
      if (waitMs > 0) return Math.min(waitMs, MAX_BACKOFF_MS);
    }
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub enumeration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all icon directories under symbols/web/ using the Contents API.
 * The API returns at most 1000 entries per page; pagination via `?page=N`.
 */
async function listIconNames(token: string | undefined): Promise<string[]> {
  const names: string[] = [];
  let page = 1;
  const perPage = 100;
  // GitHub contents endpoint returns all entries in a directory in a single
  // response if it fits (<=1000). For safety we page defensively.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${GITHUB_API_BASE}/contents/${SYMBOLS_PATH}?ref=${DEFAULT_BRANCH}&per_page=${perPage}&page=${page}`;
    const res = await fetchWithBackoff(url, { token });
    if (!res.ok) {
      throw new Error(`Failed to list icons: ${res.status} ${res.statusText} on ${url}`);
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new Error(`Unexpected response listing icons (expected array)`);
    }
    if (body.length === 0) break;
    for (const entry of body) {
      const e = entry as { type?: string; name?: string };
      if (e.type === "dir" && typeof e.name === "string" && /^[a-z0-9_]+$/.test(e.name)) {
        names.push(e.name);
      }
    }
    if (body.length < perPage) break;
    page += 1;
  }
  names.sort();
  return names;
}

/**
 * Fetches the per-icon upstream metadata.json if present. Returns an
 * UpstreamIconMeta with whatever category / tags were found plus the set of
 * available style subdirectories.
 */
async function fetchUpstreamIconMeta(
  name: string,
  token: string | undefined,
): Promise<UpstreamIconMeta> {
  const dirUrl = `${GITHUB_API_BASE}/contents/${SYMBOLS_PATH}/${name}?ref=${DEFAULT_BRANCH}`;
  const dirRes = await fetchWithBackoff(dirUrl, { token });
  if (!dirRes.ok) {
    throw new Error(`Failed to list icon dir ${name}: ${dirRes.status}`);
  }
  const entries = (await dirRes.json()) as Array<{ type?: string; name?: string }>;

  const availableStyles = new Set<IconStyle>();
  let hasMetadataFile = false;
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string") continue;
    if (entry.type === "dir") {
      for (const style of ALL_STYLES) {
        if (entry.name === STYLE_DIR_MAP[style]) {
          availableStyles.add(style);
        }
      }
    } else if (entry.type === "file" && entry.name === "metadata.json") {
      hasMetadataFile = true;
    }
  }

  let category: string | undefined;
  let tags: string[] | undefined;
  if (hasMetadataFile) {
    const rawUrl = `${GITHUB_RAW_BASE}/${DEFAULT_BRANCH}/${SYMBOLS_PATH}/${name}/metadata.json`;
    try {
      const mdRes = await fetchWithBackoff(rawUrl, { token, accept: "application/json" });
      if (mdRes.ok) {
        const md = (await mdRes.json()) as { category?: string; tags?: unknown; categories?: unknown };
        if (typeof md.category === "string" && md.category.length > 0) {
          category = md.category;
        }
        // Some upstream metadata uses `categories: ["action"]`.
        if (!category && Array.isArray(md.categories) && md.categories.length > 0 && typeof md.categories[0] === "string") {
          category = md.categories[0] as string;
        }
        if (Array.isArray(md.tags)) {
          tags = (md.tags as unknown[]).filter((t): t is string => typeof t === "string");
        }
      }
    } catch (err) {
      console.warn(`[sync-icons] Could not read upstream metadata.json for ${name}: ${(err as Error).message}`);
    }
  }

  return { name, category, tags, availableStyles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorization
// ─────────────────────────────────────────────────────────────────────────────

function loadCategoryMap(rootDir: string): CategoryMapFile {
  const mapPath = path.join(rootDir, "category-map.json");
  if (!fs.existsSync(mapPath)) {
    throw new Error(`category-map.json missing at ${mapPath} — required for deterministic categorization`);
  }
  const raw = fs.readFileSync(mapPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<CategoryMapFile> & { prefixes?: unknown };
  if (!parsed || typeof parsed !== "object" || typeof parsed.prefixes !== "object" || parsed.prefixes === null) {
    throw new Error(`category-map.json malformed — expected { prefixes: { "prefix": "category" } }`);
  }
  const entries: Record<string, string> = {};
  for (const [prefix, category] of Object.entries(parsed.prefixes as Record<string, unknown>)) {
    if (typeof prefix !== "string" || typeof category !== "string") continue;
    if (prefix.length === 0 || category.length === 0) continue;
    entries[prefix] = category;
  }
  return { prefixes: entries };
}

/**
 * Deterministic prefix match. Longest prefix wins (so `arrow_back` hits
 * `arrow_` even if a shorter `a` prefix existed).
 */
function categoryFromPrefix(name: string, map: CategoryMapFile): string | undefined {
  const prefixes = Object.keys(map.prefixes).sort((a, b) => b.length - a.length);
  for (const p of prefixes) {
    if (name.startsWith(p)) return map.prefixes[p];
  }
  // Exact-match entries (e.g. "search", "home", "delete") also live in the map.
  if (map.prefixes[name]) return map.prefixes[name];
  return undefined;
}

function deriveAliases(name: string): string[] {
  const tokens = name.split("_").filter(Boolean).map((t) => t.toLowerCase());
  // Aliases must be non-empty per schema; fall back to the full name.
  return tokens.length > 0 ? Array.from(new Set(tokens)) : [name];
}

function deriveTags(category: string, name: string, upstreamTags: string[] | undefined): string[] {
  const tokens = name.split("_").filter(Boolean).map((t) => t.toLowerCase());
  const combined = [category, ...tokens, ...(upstreamTags ?? [])];
  return Array.from(new Set(combined.filter((t) => t.length > 0)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Download
// ─────────────────────────────────────────────────────────────────────────────

interface DownloadStats {
  downloaded: number;
  skipped: number;
  failed: number;
}

async function downloadSvg(
  name: string,
  style: IconStyle,
  rootDir: string,
  token: string | undefined,
  dryRun: boolean,
): Promise<"downloaded" | "skipped" | "failed"> {
  const destDir = path.join(rootDir, style);
  const destFile = path.join(destDir, `${name}.svg`);

  // Resumability: skip non-empty existing files.
  try {
    const stat = fs.statSync(destFile);
    if (stat.isFile() && stat.size > 0) return "skipped";
  } catch {
    // not present, continue
  }

  // Upstream path: symbols/web/<name>/<style_dir>/<name>_24px.svg
  const styleDir = STYLE_DIR_MAP[style];
  const url = `${GITHUB_RAW_BASE}/${DEFAULT_BRANCH}/${SYMBOLS_PATH}/${name}/${styleDir}/${name}_24px.svg`;

  if (dryRun) {
    console.log(`[dry-run] would download ${style}/${name}.svg from ${url}`);
    return "downloaded";
  }

  try {
    const res = await fetchWithBackoff(url, { token, accept: "image/svg+xml" });
    if (!res.ok) {
      // 404 → style genuinely absent for this icon (rare for Material Symbols).
      if (res.status === 404) {
        console.warn(`[sync-icons] ${style}/${name}.svg not found upstream (404)`);
        return "failed";
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const text = await res.text();
    if (text.length === 0) {
      throw new Error(`Empty body for ${url}`);
    }
    await writeFileAtomic(destFile, text);
    return "downloaded";
  } catch (err) {
    console.warn(`[sync-icons] Failed ${style}/${name}.svg: ${(err as Error).message}`);
    return "failed";
  }
}

async function writeFileAtomic(dest: string, data: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
  await fs.promises.writeFile(tmp, data, "utf-8");
  await fs.promises.rename(tmp, dest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let opts: SyncOptions;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`[sync-icons] ${(err as Error).message}`);
    printHelp();
    return 2;
  }

  const started = Date.now();

  if (!opts.token) {
    console.warn(
      "[sync-icons] GITHUB_TOKEN not set — unauthenticated requests are limited to 60/hour by GitHub.",
    );
  }

  console.log(`[sync-icons] Root: ${opts.rootDir}`);
  console.log(`[sync-icons] Styles: ${opts.styles.join(", ")}`);
  console.log(`[sync-icons] Concurrency: ${opts.concurrency}`);
  if (opts.dryRun) console.log(`[sync-icons] DRY RUN — no files will be written.`);

  // Ensure directories exist even on dry-run so subsequent enumeration works.
  for (const style of opts.styles) {
    if (!opts.dryRun) {
      fs.mkdirSync(path.join(opts.rootDir, style), { recursive: true });
    }
  }

  const categoryMap = loadCategoryMap(opts.rootDir);

  console.log(`[sync-icons] Enumerating icons from ${GITHUB_API_BASE}/contents/${SYMBOLS_PATH} ...`);
  let names = await listIconNames(opts.token);
  if (typeof opts.limit === "number") {
    names = names.slice(0, opts.limit);
  }
  console.log(`[sync-icons] Discovered ${names.length} icons.`);

  // Fetch per-icon upstream metadata concurrently.
  const metaLimiter = pLimit(opts.concurrency);
  const upstreamMetas: UpstreamIconMeta[] = [];
  let metaFailed = 0;
  await Promise.all(
    names.map((name) =>
      metaLimiter(async () => {
        try {
          const meta = await fetchUpstreamIconMeta(name, opts.token);
          upstreamMetas.push(meta);
        } catch (err) {
          metaFailed += 1;
          console.warn(`[sync-icons] meta fetch failed for ${name}: ${(err as Error).message}`);
        }
      }),
    ),
  );

  if (upstreamMetas.length === 0) {
    console.error("[sync-icons] No upstream metadata collected — aborting.");
    return 1;
  }
  if (metaFailed / names.length > MAX_FAILURE_RATIO) {
    console.error(
      `[sync-icons] Upstream metadata failure ratio ${metaFailed}/${names.length} exceeds ${MAX_FAILURE_RATIO * 100}%`,
    );
    return 1;
  }

  // Resolve category for every icon, collecting uncategorizable ones.
  const uncategorized: string[] = [];
  const records: IconRecord[] = [];
  for (const meta of upstreamMetas) {
    const category = meta.category ?? categoryFromPrefix(meta.name, categoryMap);
    if (!category) {
      uncategorized.push(meta.name);
      continue;
    }
    // Only include requested styles that exist upstream.
    const intersected: IconStyle[] = opts.styles.filter((s) => meta.availableStyles.has(s));
    if (intersected.length === 0) {
      console.warn(`[sync-icons] ${meta.name}: no requested styles available upstream — skipping`);
      continue;
    }
    const aliases = deriveAliases(meta.name);
    const tags = deriveTags(category, meta.name, meta.tags);
    records.push({
      name: meta.name,
      category,
      tags,
      aliases,
      styles: intersected,
    });
  }

  if (uncategorized.length > 0) {
    console.error(
      `[sync-icons] ${uncategorized.length} icons cannot be categorized via upstream metadata OR ${path.join(opts.rootDir, "category-map.json")}:\n  ` +
        uncategorized.slice(0, 50).join("\n  ") +
        (uncategorized.length > 50 ? `\n  ... and ${uncategorized.length - 50} more` : ""),
    );
    console.error(
      "[sync-icons] Extend category-map.json with prefixes for the above icons and re-run. No 'uncategorized' fallback is permitted (REQ-076).",
    );
    return 1;
  }

  records.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[sync-icons] Resolved metadata for ${records.length} icons.`);

  // Download SVGs.
  const downloadLimiter = pLimit(opts.concurrency);
  const stats: DownloadStats = { downloaded: 0, skipped: 0, failed: 0 };
  let processed = 0;
  const total = records.length * opts.styles.length;

  await Promise.all(
    records.flatMap((record) =>
      record.styles.map((style) =>
        downloadLimiter(async () => {
          const outcome = await downloadSvg(record.name, style, opts.rootDir, opts.token, opts.dryRun);
          if (outcome === "downloaded") stats.downloaded += 1;
          else if (outcome === "skipped") stats.skipped += 1;
          else stats.failed += 1;
          processed += 1;
          if (processed % 100 === 0) {
            console.log(
              `[sync-icons] ${processed}/${total} — downloaded ${stats.downloaded}, skipped ${stats.skipped}, failed ${stats.failed}`,
            );
          }
        }),
      ),
    ),
  );

  const failureRatio = total === 0 ? 0 : stats.failed / total;
  if (failureRatio > MAX_FAILURE_RATIO) {
    console.error(
      `[sync-icons] Download failure ratio ${stats.failed}/${total} (${(failureRatio * 100).toFixed(2)}%) exceeds ${MAX_FAILURE_RATIO * 100}% threshold.`,
    );
    return 1;
  }

  // Prune any style entries whose SVG did not end up on disk (so metadata.json
  // only references files that exist). Defensive even for resumed runs.
  if (!opts.dryRun) {
    for (const record of records) {
      record.styles = record.styles.filter((style) => {
        const file = path.join(opts.rootDir, style, `${record.name}.svg`);
        try {
          const s = fs.statSync(file);
          return s.isFile() && s.size > 0;
        } catch {
          return false;
        }
      }) as IconStyle[];
    }
  }
  const finalRecords = records.filter((r) => r.styles.length > 0);

  const metadata: MetadataFile = {
    version: METADATA_VERSION,
    source: "google/material-design-icons",
    generated: new Date().toISOString(),
    icons: finalRecords,
  };

  // Validate against schema BEFORE writing.
  const schemaPath = path.join(opts.rootDir, "metadata.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(metadata)) {
    console.error("[sync-icons] Generated metadata.json FAILED schema validation:");
    for (const err of (validate.errors ?? []) as ErrorObject[]) {
      console.error(`  ${err.instancePath} ${err.message}`);
    }
    return 1;
  }

  if (opts.dryRun) {
    console.log(`[dry-run] Would write metadata.json with ${finalRecords.length} entries to ${opts.rootDir}/metadata.json`);
  } else {
    await writeFileAtomic(path.join(opts.rootDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
    console.log(`[sync-icons] Wrote metadata.json (${finalRecords.length} entries).`);
  }

  // Summary
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const cacheHitRate = total === 0 ? 0 : stats.skipped / total;
  console.log(
    [
      "",
      `[sync-icons] Summary`,
      `  icons:       ${finalRecords.length}`,
      `  styles:      ${opts.styles.join(", ")}`,
      `  downloaded:  ${stats.downloaded}`,
      `  skipped:     ${stats.skipped}`,
      `  failed:      ${stats.failed}`,
      `  total ops:   ${total}`,
      `  cache hit:   ${(cacheHitRate * 100).toFixed(1)}%`,
      `  elapsed:     ${elapsed}s`,
    ].join("\n"),
  );

  return 0;
}

// Allow importing main() for tests without running it as a side effect.
// When executed as a CLI (entry point is this file) we run main() directly.
const entryPath = process.argv[1] ? fs.realpathSync(process.argv[1]) : "";
const selfPath = fs.realpathSync(new URL(import.meta.url).pathname);
if (entryPath === selfPath) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[sync-icons] Fatal:`, err);
      process.exit(1);
    },
  );
}

export { main, parseArgs, loadCategoryMap, categoryFromPrefix, deriveAliases, deriveTags };
export type { SyncOptions, IconRecord, MetadataFile };

// Silence "unused import" for os on platforms where it's not needed.
void os;
