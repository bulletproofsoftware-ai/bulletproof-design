/**
 * Integration tests for scripts/migrate-brands.ts.
 *
 * Covers REQ-050, REQ-078 invariants:
 *   - --dry-run prints plans but writes nothing
 *   - a flat brand is converted to directory format with brand.json +
 *     guidelines.md + assets/
 *   - re-running is idempotent (skips already-migrated brands)
 *   - non-zero exit on failure
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { run, parseArgs, scanCandidates, DEFAULT_GUIDELINES } from "../scripts/migrate-brands";

function freshTmp(tag: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `design-lib-migrate-${tag}-`));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_BRAND = {
  name: "Default",
  slug: "default",
  description: "Sample",
  colors: { primary: "#3b82f6" },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8] },
  borderRadius: { small: "4px", medium: "8px", large: "12px", full: "9999px" },
  shadows: { small: "", medium: "", large: "" },
};

describe("parseArgs", () => {
  test("parses dry-run, slug, and flat disposition flags", () => {
    const opts = parseArgs([
      "node",
      "migrate-brands.ts",
      "--dry-run",
      "--slug=default",
      "--delete-flat",
    ]);
    expect(opts.dryRun).toBe(true);
    expect(opts.onlySlug).toBe("default");
    expect(opts.flatDisposition).toBe("delete");
  });

  test("defaults to --keep-flat when no disposition provided", () => {
    const opts = parseArgs(["node", "migrate-brands.ts"]);
    expect(opts.flatDisposition).toBe("keep");
    expect(opts.dryRun).toBe(false);
  });

  test("rejects malformed --slug", () => {
    expect(() =>
      parseArgs(["node", "migrate-brands.ts", "--slug=Bad Slug"]),
    ).toThrow(/Invalid --slug/);
  });

  test("rejects unknown arguments", () => {
    expect(() => parseArgs(["node", "migrate-brands.ts", "--bogus"])).toThrow(
      /Unknown argument/,
    );
  });
});

describe("scanCandidates", () => {
  test("returns all flat .json files", async () => {
    const dir = freshTmp("scan");
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(SAMPLE_BRAND));
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(SAMPLE_BRAND));
    const candidates = await scanCandidates(dir);
    expect(candidates).toEqual(["a", "b"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("honours --slug filter", async () => {
    const dir = freshTmp("scan-slug");
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(SAMPLE_BRAND));
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(SAMPLE_BRAND));
    expect(await scanCandidates(dir, "a")).toEqual(["a"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("returns [] for nonexistent directory", async () => {
    expect(await scanCandidates("/nonexistent-path-xyzzy")).toEqual([]);
  });

  test("skips files with non-conforming slugs", async () => {
    const dir = freshTmp("scan-bad");
    fs.writeFileSync(path.join(dir, "Has Spaces.json"), JSON.stringify(SAMPLE_BRAND));
    fs.writeFileSync(path.join(dir, "valid-slug.json"), JSON.stringify(SAMPLE_BRAND));
    const candidates = await scanCandidates(dir);
    expect(candidates).toEqual(["valid-slug"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("run — dry-run mode", () => {
  test("does not write any files", async () => {
    const dir = freshTmp("dry");
    fs.writeFileSync(path.join(dir, "default.json"), JSON.stringify(SAMPLE_BRAND));

    const result = await run({
      dryRun: true,
      flatDisposition: "keep",
      brandsDir: dir,
    });

    expect(result.migrated).toContain("default");
    // In dry-run, the "migrated" list reflects planned migrations.
    expect(fs.existsSync(path.join(dir, "default", "brand.json"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "default"))).toBe(false);
    // Original flat file is untouched.
    expect(fs.existsSync(path.join(dir, "default.json"))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("run — migration", () => {
  test("converts flat → directory with brand.json, guidelines.md, assets/", async () => {
    const dir = freshTmp("mig");
    const flat = path.join(dir, "default.json");
    fs.writeFileSync(flat, JSON.stringify(SAMPLE_BRAND, null, 2), "utf-8");

    const result = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
    });

    expect(result.migrated).toEqual(["default"]);
    expect(result.failed).toEqual([]);

    const brandDir = path.join(dir, "default");
    expect(fs.existsSync(path.join(brandDir, "brand.json"))).toBe(true);
    expect(fs.existsSync(path.join(brandDir, "guidelines.md"))).toBe(true);
    expect(fs.existsSync(path.join(brandDir, "assets"))).toBe(true);

    // Content is preserved verbatim.
    const written = fs.readFileSync(path.join(brandDir, "brand.json"), "utf-8");
    const original = fs.readFileSync(flat, "utf-8");
    expect(written).toBe(original);

    // Default guidelines template is written.
    const guidelines = fs.readFileSync(path.join(brandDir, "guidelines.md"), "utf-8");
    expect(guidelines).toBe(DEFAULT_GUIDELINES);

    // --keep-flat preserved the original.
    expect(fs.existsSync(flat)).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("--delete-flat removes the original .json file", async () => {
    const dir = freshTmp("del");
    const flat = path.join(dir, "default.json");
    fs.writeFileSync(flat, JSON.stringify(SAMPLE_BRAND), "utf-8");

    await run({
      dryRun: false,
      flatDisposition: "delete",
      brandsDir: dir,
    });

    expect(fs.existsSync(flat)).toBe(false);
    expect(fs.existsSync(path.join(dir, "default", "brand.json"))).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("is idempotent — second run skips already-migrated brands", async () => {
    const dir = freshTmp("idem");
    fs.writeFileSync(
      path.join(dir, "default.json"),
      JSON.stringify(SAMPLE_BRAND),
      "utf-8",
    );

    const first = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
    });
    expect(first.migrated).toEqual(["default"]);

    // Author edits guidelines.md after migration — must not be clobbered.
    const guidelinesPath = path.join(dir, "default", "guidelines.md");
    const AUTHORED = "# Authored\n\nContent.\n";
    fs.writeFileSync(guidelinesPath, AUTHORED, "utf-8");

    const second = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
    });
    expect(second.migrated).toEqual([]);
    expect(second.skipped.map((s) => s.slug)).toContain("default");
    expect(second.failed).toEqual([]);

    // Authored guidelines preserved.
    expect(fs.readFileSync(guidelinesPath, "utf-8")).toBe(AUTHORED);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("--slug filter migrates only the named brand", async () => {
    const dir = freshTmp("slug");
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(SAMPLE_BRAND));
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(SAMPLE_BRAND));

    const result = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
      onlySlug: "a",
    });

    expect(result.migrated).toEqual(["a"]);
    expect(fs.existsSync(path.join(dir, "a", "brand.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "b"))).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("reports failure for malformed JSON (without aborting other brands)", async () => {
    const dir = freshTmp("malformed");
    fs.writeFileSync(path.join(dir, "bad.json"), "{ not json", "utf-8");
    fs.writeFileSync(path.join(dir, "good.json"), JSON.stringify(SAMPLE_BRAND), "utf-8");

    const result = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
    });

    expect(result.failed.map((f) => f.slug)).toContain("bad");
    expect(result.migrated).toContain("good");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("returns empty result for empty directory", async () => {
    const dir = freshTmp("empty");
    const result = await run({
      dryRun: false,
      flatDisposition: "keep",
      brandsDir: dir,
    });
    expect(result.migrated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
