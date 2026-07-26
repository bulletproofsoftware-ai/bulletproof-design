/**
 * Brand writer — directory-format writes.
 *
 * `writeBrand` always writes `brands/<slug>/brand.json` (creating the
 * directory, a stub `guidelines.md`, and `assets/` on first write).
 *
 * `deleteBrand` removes the directory if present; otherwise falls back to
 * deleting a flat `brands/<slug>.json` file for back-compat.
 *
 * `writeLogo` / `deleteLogo` manage binary files in `brands/<slug>/assets/`
 * with path-traversal protection.
 *
 * All operations use `fs.promises`. Implements BRD REQ-001, REQ-052, REQ-070.
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { BrandConfig } from "./brandIndex";
import { safeJoin, validateSlug, validateAssetFilename } from "./safeJoin";

const BRANDS_DIR = process.env.BRANDS_DIR ?? "./brands";

/** Resolve the brands directory lazily so tests can override via env var. */
function brandsRoot(): string {
  return path.resolve(process.env.BRANDS_DIR ?? BRANDS_DIR);
}

/**
 * Default `guidelines.md` template written alongside new brands. Brand
 * managers edit this file in place.
 */
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

/**
 * Write a brand in directory format.
 *
 * Idempotent with respect to the directory structure:
 *  - Creates `brands/<slug>/assets/` if missing.
 *  - Creates `brands/<slug>/guidelines.md` with the default template only if
 *    it does not already exist (never overwrites authored content).
 *  - Always overwrites `brands/<slug>/brand.json` with the new config.
 *
 * Returns the absolute path of the written `brand.json`.
 */
export async function writeBrand(brand: BrandConfig): Promise<string> {
  const slug = validateSlug(brand.slug);
  const root = brandsRoot();

  const brandDir = safeJoin(root, slug);
  const assetsDir = safeJoin(root, slug, "assets");
  const brandJsonPath = safeJoin(root, slug, "brand.json");
  const guidelinesPath = safeJoin(root, slug, "guidelines.md");

  await fsp.mkdir(brandDir, { recursive: true });
  await fsp.mkdir(assetsDir, { recursive: true });

  // Strip internal `_source` marker — never persist it.
  const { _source: _drop, ...toWrite } = brand;
  void _drop;

  await fsp.writeFile(
    brandJsonPath,
    JSON.stringify(toWrite, null, 2) + "\n",
    "utf-8",
  );

  // Only create guidelines.md if it does not exist (preserve authored content).
  try {
    await fsp.access(guidelinesPath, fs.constants.F_OK);
    // Already exists — do nothing.
  } catch {
    await fsp.writeFile(guidelinesPath, DEFAULT_GUIDELINES, "utf-8");
  }

  return brandJsonPath;
}

/**
 * Synchronous convenience wrapper — routes that currently call
 * `writeBrand(config)` expecting a synchronous filesystem path. We forward
 * to `fs` sync calls to preserve the prior contract for any callers that
 * have not migrated to async.
 *
 * Prefer `writeBrand` (async) in new code.
 */
export function writeBrandSync(brand: BrandConfig): { path: string } {
  const slug = validateSlug(brand.slug);
  const root = brandsRoot();

  const brandDir = safeJoin(root, slug);
  const assetsDir = safeJoin(root, slug, "assets");
  const brandJsonPath = safeJoin(root, slug, "brand.json");
  const guidelinesPath = safeJoin(root, slug, "guidelines.md");

  fs.mkdirSync(brandDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const { _source: _drop, ...toWrite } = brand;
  void _drop;

  fs.writeFileSync(
    brandJsonPath,
    JSON.stringify(toWrite, null, 2) + "\n",
    "utf-8",
  );

  // Exclusive create rather than exists-then-write: between the two calls another
  // writer can create the file and have it silently overwritten
  // (CodeQL js/file-system-race). `wx` makes the check and the write one atomic
  // operation; EEXIST simply means someone else authored it, which is the
  // outcome the guard wanted.
  try {
    fs.writeFileSync(guidelinesPath, DEFAULT_GUIDELINES, { encoding: "utf-8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  return { path: brandJsonPath };
}

/**
 * Delete a brand.
 *
 * - If `brands/<slug>/` exists, remove it recursively.
 * - Else, if `brands/<slug>.json` exists, remove the flat file.
 * - Else return `false`.
 */
export async function deleteBrand(slug: string): Promise<boolean> {
  const safeSlug = validateSlug(slug);
  const root = brandsRoot();
  const dirPath = safeJoin(root, safeSlug);
  const flatPath = safeJoin(root, `${safeSlug}.json`);

  let deleted = false;

  try {
    const stat = await fsp.stat(dirPath);
    if (stat.isDirectory()) {
      await fsp.rm(dirPath, { recursive: true, force: true });
      deleted = true;
    }
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") throw err;
  }

  // Even if a directory was removed, also clean up a stray flat file to
  // avoid confusion on re-list.
  try {
    await fsp.unlink(flatPath);
    deleted = true;
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") throw err;
  }

  return deleted;
}

/**
 * Sync delete (back-compat for the existing sync API surface). Mirrors
 * the async variant but uses sync fs calls.
 */
export function deleteBrandSync(slug: string): boolean {
  const safeSlug = validateSlug(slug);
  const root = brandsRoot();
  const dirPath = safeJoin(root, safeSlug);
  const flatPath = safeJoin(root, `${safeSlug}.json`);

  let deleted = false;

  try {
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory()) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      deleted = true;
    }
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") throw err;
  }

  try {
    fs.unlinkSync(flatPath);
    deleted = true;
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code !== "ENOENT") throw err;
  }

  return deleted;
}

/**
 * Write a binary asset (typically a logo SVG/PNG) into
 * `brands/<slug>/assets/<filename>`.
 *
 * Creates the directory if missing. Validates slug and filename.
 * Returns the absolute path of the written file.
 */
export async function writeLogo(
  slug: string,
  filename: string,
  bytes: Buffer | Uint8Array,
): Promise<string> {
  const safeSlug = validateSlug(slug);
  const safeName = validateAssetFilename(filename);
  const root = brandsRoot();
  const assetsDir = safeJoin(root, safeSlug, "assets");
  const filePath = safeJoin(root, safeSlug, "assets", safeName);

  await fsp.mkdir(assetsDir, { recursive: true });
  await fsp.writeFile(filePath, bytes);
  return filePath;
}

/**
 * Delete a logo asset. Returns true if removed, false if it did not exist.
 */
export async function deleteLogo(
  slug: string,
  filename: string,
): Promise<boolean> {
  const safeSlug = validateSlug(slug);
  const safeName = validateAssetFilename(filename);
  const root = brandsRoot();
  const filePath = safeJoin(root, safeSlug, "assets", safeName);

  try {
    await fsp.unlink(filePath);
    return true;
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") return false;
    throw err;
  }
}
