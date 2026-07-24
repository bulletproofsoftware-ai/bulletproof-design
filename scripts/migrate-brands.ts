#!/usr/bin/env tsx
/**
 * scripts/migrate-brands.ts
 *
 * Converts flat brand files (`brands/<slug>.json`) to the new directory
 * format (`brands/<slug>/{brand.json, guidelines.md, assets/}`).
 *
 * Idempotent: re-running skips brands that are already migrated. Exits
 * non-zero on any unexpected error (but never on a clean no-op).
 *
 * Flags:
 *   --dry-run       Print planned actions without writing anything.
 *   --slug=<slug>   Migrate only the named slug.
 *   --keep-flat     Preserve the original `<slug>.json` after migration
 *                   (default behaviour — the loader picks directory first,
 *                   so the flat file becomes a warning-only artifact).
 *   --delete-flat   Remove the original `<slug>.json` after successful copy.
 *
 * Implements BRD REQ-050, REQ-056, REQ-078.
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

// ────────────────────────────────────────────────────────────────────────
// CLI parsing
// ────────────────────────────────────────────────────────────────────────

interface CliOptions {
  dryRun: boolean;
  onlySlug?: string;
  /** 'keep' | 'delete' — 'keep' is the default. */
  flatDisposition: "keep" | "delete";
  brandsDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let onlySlug: string | undefined;
  let flatDisposition: "keep" | "delete" = "keep";

  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run" || arg === "-n") {
      dryRun = true;
    } else if (arg === "--keep-flat") {
      flatDisposition = "keep";
    } else if (arg === "--delete-flat") {
      flatDisposition = "delete";
    } else if (arg.startsWith("--slug=")) {
      onlySlug = arg.slice("--slug=".length);
      if (!/^[a-z0-9-]+$/.test(onlySlug)) {
        throw new Error(`Invalid --slug=${onlySlug}`);
      }
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    dryRun,
    onlySlug,
    flatDisposition,
    brandsDir: process.env.BRANDS_DIR ?? "./brands",
  };
}

function printUsage(): void {
  console.log(`
Usage: tsx scripts/migrate-brands.ts [options]

Options:
  --dry-run, -n         Print planned actions without writing anything.
  --slug=<slug>         Migrate only the named slug.
  --keep-flat           Preserve the original .json after migration (default).
  --delete-flat         Remove the original .json after successful migration.
  --help, -h            Show this message.

Environment:
  BRANDS_DIR            Override the default ./brands directory.
`);
}

// ────────────────────────────────────────────────────────────────────────
// Migration logic
// ────────────────────────────────────────────────────────────────────────

const DEFAULT_GUIDELINES = `---
sections:
  - slug: logo-usage
    title: Logo Usage
  - slug: color-usage
    title: Color Usage
  - slug: imagery
    title: Imagery
---

## Logo Usage

(Authored by brand manager.)

## Color Usage

(Authored by brand manager.)

## Imagery

(Authored by brand manager.)
`;

interface MigrationResult {
  migrated: string[];
  skipped: Array<{ slug: string; reason: string }>;
  failed: Array<{ slug: string; error: string }>;
}

/**
 * Scan the brands directory and return the list of flat files that are
 * candidates for migration.
 */
async function scanCandidates(
  brandsDir: string,
  onlySlug?: string,
): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(brandsDir, { withFileTypes: true });
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") return [];
    throw err;
  }

  const candidates: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json")) continue;
    const slug = entry.name.slice(0, -".json".length);
    if (onlySlug && slug !== onlySlug) continue;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      // Skip non-conforming slugs silently; they will never be written as
      // directories and are not valid brand files anyway.
      continue;
    }
    candidates.push(slug);
  }
  return candidates.sort();
}

/**
 * Migrate a single flat brand to directory format.
 *
 * Preconditions:
 *   - `brands/<slug>.json` exists.
 *
 * Postconditions (when not dry-run):
 *   - `brands/<slug>/brand.json` exists with identical content.
 *   - `brands/<slug>/guidelines.md` exists (default template or preserved).
 *   - `brands/<slug>/assets/` exists.
 *   - Flat file either preserved (`keep`) or removed (`delete`).
 */
async function migrateOne(
  brandsDir: string,
  slug: string,
  opts: CliOptions,
): Promise<"migrated" | "skipped" | "failed"> {
  const flatPath = path.join(brandsDir, `${slug}.json`);
  const dirPath = path.join(brandsDir, slug);
  const brandJsonPath = path.join(dirPath, "brand.json");
  const guidelinesPath = path.join(dirPath, "guidelines.md");
  const assetsDir = path.join(dirPath, "assets");

  // Idempotency check — if brand.json already exists, skip.
  try {
    await fsp.access(brandJsonPath, fs.constants.F_OK);
    console.log(`[skipped] ${slug} — already migrated`);
    return "skipped";
  } catch {
    // Not migrated yet — proceed.
  }

  // Read the flat source. If it fails (malformed JSON, disappeared), report.
  let raw: string;
  try {
    raw = await fsp.readFile(flatPath, "utf-8");
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[failed]  ${slug} — cannot read ${flatPath}: ${msg}`);
    return "failed";
  }

  // Validate it is parseable JSON (but preserve formatting verbatim when
  // writing to brand.json).
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("brand.json is not an object");
    }
    if (typeof parsed.slug !== "string" || typeof parsed.name !== "string") {
      throw new Error("brand.json missing required name/slug");
    }
    if (parsed.slug !== slug) {
      console.warn(
        `[warn]    ${slug}: internal slug "${parsed.slug}" does not match filename; using filename`,
      );
    }
  } catch (err) {
    console.error(`[failed]  ${slug} — invalid brand.json: ${(err as Error).message}`);
    return "failed";
  }

  if (opts.dryRun) {
    console.log(
      `[plan]    ${slug}: mkdir ${path.relative(process.cwd(), dirPath)}/, ` +
        `write brand.json, write guidelines.md, mkdir assets/` +
        (opts.flatDisposition === "delete" ? `, rm ${entryName(flatPath)}` : ""),
    );
    return "migrated";
  }

  try {
    await fsp.mkdir(dirPath, { recursive: true });
    await fsp.mkdir(assetsDir, { recursive: true });

    // Write brand.json verbatim (no schema upgrade on migration).
    await fsp.writeFile(brandJsonPath, raw, "utf-8");

    // Only create guidelines.md if missing — never overwrite authored content.
    try {
      await fsp.access(guidelinesPath, fs.constants.F_OK);
    } catch {
      await fsp.writeFile(guidelinesPath, DEFAULT_GUIDELINES, "utf-8");
    }

    if (opts.flatDisposition === "delete") {
      await fsp.unlink(flatPath);
    }

    console.log(`[migrated] ${slug}`);
    return "migrated";
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[failed]  ${slug} — ${msg}`);
    // Best-effort cleanup — leave the partially-created directory so the
    // operator can inspect. Idempotent re-run will either pick up where it
    // left off or report the error again.
    return "failed";
  }
}

function entryName(p: string): string {
  return path.relative(process.cwd(), p);
}

async function run(opts: CliOptions): Promise<MigrationResult> {
  const brandsDir = path.resolve(opts.brandsDir);

  // Ensure the directory exists (even if empty — no-op migration).
  try {
    const stat = await fsp.stat(brandsDir);
    if (!stat.isDirectory()) {
      throw new Error(`${brandsDir} is not a directory`);
    }
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      console.log(`[info] ${brandsDir} does not exist — nothing to migrate.`);
      return { migrated: [], skipped: [], failed: [] };
    }
    throw err;
  }

  const candidates = await scanCandidates(brandsDir, opts.onlySlug);

  if (candidates.length === 0) {
    if (opts.onlySlug) {
      console.log(`[info] No flat brand named "${opts.onlySlug}" found in ${brandsDir}.`);
    } else {
      console.log(`[info] No flat brand files found in ${brandsDir} — nothing to migrate.`);
    }
    return { migrated: [], skipped: [], failed: [] };
  }

  console.log(
    `[info] Scanning ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}` +
      ` in ${brandsDir}` +
      (opts.dryRun ? " (dry-run)" : "") +
      ` — flat disposition: ${opts.flatDisposition}`,
  );

  const result: MigrationResult = { migrated: [], skipped: [], failed: [] };

  for (const slug of candidates) {
    const outcome = await migrateOne(brandsDir, slug, opts);
    if (outcome === "migrated") {
      result.migrated.push(slug);
    } else if (outcome === "skipped") {
      result.skipped.push({ slug, reason: "already migrated" });
    } else {
      result.failed.push({ slug, error: "see log above" });
    }
  }

  return result;
}

function printSummary(result: MigrationResult, opts: CliOptions): void {
  console.log("");
  console.log("─── Summary ─────────────────────────────────────────────");
  console.log(`  migrated: ${result.migrated.length}`);
  console.log(`  skipped:  ${result.skipped.length}`);
  console.log(`  failed:   ${result.failed.length}`);
  if (opts.dryRun) {
    console.log("  (dry-run — no files were modified)");
  }
  if (result.failed.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of result.failed) {
      console.log(`  - ${f.slug}: ${f.error}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    printUsage();
    return 2;
  }

  try {
    const result = await run(opts);
    printSummary(result, opts);
    return result.failed.length > 0 ? 1 : 0;
  } catch (err) {
    console.error(`Fatal: ${(err as Error).message}`);
    return 1;
  }
}

// Allow importing for tests without executing.
// (Detect direct CLI invocation via argv[1] match.)
const invokedDirectly =
  typeof process !== "undefined" &&
  typeof process.argv[1] === "string" &&
  /migrate-brands\.(ts|js|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  main().then((code) => process.exit(code));
}

export { run, parseArgs, migrateOne, scanCandidates, DEFAULT_GUIDELINES };
export type { CliOptions, MigrationResult };
