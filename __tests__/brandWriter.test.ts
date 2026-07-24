/**
 * Unit tests for brand writer — directory-format writes, deletes, and
 * logo upload/delete.
 *
 * Covers BRD REQ-052 and REQ-070 path safety invariants.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TMP_BRANDS = path.join(
  os.tmpdir(),
  "design-lib-brand-writer-" + Date.now(),
);
fs.mkdirSync(TMP_BRANDS, { recursive: true });

// Must set env before dynamic import so the writer picks it up.
process.env.BRANDS_DIR = TMP_BRANDS;

const {
  writeBrand,
  writeBrandSync,
  deleteBrand,
  deleteBrandSync,
  writeLogo,
  deleteLogo,
} = await import("../src/api/lib/brandWriter");

type BrandConfigType = {
  name: string;
  slug: string;
  description: string;
  logo: { mark: string; horizontal: string; favicon: string };
  colors: Record<string, string>;
  fonts: { heading: string; body: string; mono: string };
  spacing: { unit: number; scale: number[] };
  borderRadius: { small: string; medium: string; large: string; full: string };
  shadows: { small: string; medium: string; large: string };
};

const SAMPLE_BRAND: BrandConfigType = {
  name: "Writer Test",
  slug: "writer-test",
  description: "Test brand for writer",
  logo: { mark: "", horizontal: "", favicon: "" },
  colors: {
    primary: "#3b82f6", secondary: "#1e293b", accent: "#10b981",
    background: "#f8fafc", surface: "#ffffff", text: "#0f172a",
    textMuted: "#64748b", border: "#e2e8f0", error: "#ef4444",
    warning: "#f59e0b", success: "#22c55e",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 16] },
  borderRadius: { small: "4px", medium: "8px", large: "12px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
};

afterAll(() => {
  fs.rmSync(TMP_BRANDS, { recursive: true, force: true });
});

describe("writeBrand (async, directory format)", () => {
  test("creates brand directory with brand.json, guidelines.md, and assets/", async () => {
    const filePath = await writeBrand(SAMPLE_BRAND as any);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(filePath.endsWith(path.join("writer-test", "brand.json"))).toBe(true);

    const brandDir = path.dirname(filePath);
    expect(fs.existsSync(path.join(brandDir, "guidelines.md"))).toBe(true);
    expect(fs.existsSync(path.join(brandDir, "assets"))).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(content.name).toBe("Writer Test");
    expect(content.slug).toBe("writer-test");
    expect(content.colors.primary).toBe("#3b82f6");
  });

  test("overwrites brand.json but preserves guidelines.md on re-write", async () => {
    // Author edits guidelines.md after creation — our re-write must not
    // clobber the author's work.
    const brandDir = path.join(TMP_BRANDS, "writer-test");
    const guidelinesPath = path.join(brandDir, "guidelines.md");
    const AUTHORED = "# Custom guidelines content — do not overwrite\n";
    fs.writeFileSync(guidelinesPath, AUTHORED, "utf-8");

    const updated = { ...SAMPLE_BRAND, name: "Updated Name" };
    const filePath = await writeBrand(updated as any);

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(content.name).toBe("Updated Name");

    // Guidelines must be preserved verbatim.
    expect(fs.readFileSync(guidelinesPath, "utf-8")).toBe(AUTHORED);
  });

  test("rejects invalid slugs", async () => {
    const bad = { ...SAMPLE_BRAND, slug: "Has Spaces" };
    await expect(writeBrand(bad as any)).rejects.toThrow(/Invalid slug/);
  });
});

describe("writeBrandSync", () => {
  test("writes synchronously and returns the brand.json path", () => {
    const result = writeBrandSync({ ...SAMPLE_BRAND, slug: "sync-brand" } as any);
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path.endsWith(path.join("sync-brand", "brand.json"))).toBe(true);
  });
});

describe("deleteBrand", () => {
  test("removes directory brand including guidelines.md and assets/", async () => {
    await writeBrand({ ...SAMPLE_BRAND, slug: "to-delete" } as any);
    const deleted = await deleteBrand("to-delete");
    expect(deleted).toBe(true);
    expect(fs.existsSync(path.join(TMP_BRANDS, "to-delete"))).toBe(false);
  });

  test("removes flat brand when directory does not exist", async () => {
    const flat = path.join(TMP_BRANDS, "flat-only.json");
    fs.writeFileSync(flat, JSON.stringify(SAMPLE_BRAND), "utf-8");
    const deleted = await deleteBrand("flat-only");
    expect(deleted).toBe(true);
    expect(fs.existsSync(flat)).toBe(false);
  });

  test("returns false for nonexistent brand", async () => {
    const deleted = await deleteBrand("never-existed");
    expect(deleted).toBe(false);
  });
});

describe("deleteBrandSync", () => {
  test("synchronous delete mirrors async behaviour", () => {
    writeBrandSync({ ...SAMPLE_BRAND, slug: "sync-delete" } as any);
    expect(deleteBrandSync("sync-delete")).toBe(true);
    expect(deleteBrandSync("sync-delete")).toBe(false);
  });
});

describe("writeLogo / deleteLogo", () => {
  test("writes a logo file into the brand's assets directory", async () => {
    await writeBrand({ ...SAMPLE_BRAND, slug: "with-logo" } as any);
    const bytes = Buffer.from("<svg>fake</svg>", "utf-8");
    const p = await writeLogo("with-logo", "horizontal.svg", bytes);
    expect(fs.existsSync(p)).toBe(true);
    expect(p.endsWith(path.join("with-logo", "assets", "horizontal.svg"))).toBe(true);

    const roundTrip = fs.readFileSync(p, "utf-8");
    expect(roundTrip).toBe("<svg>fake</svg>");
  });

  test("deleteLogo returns true when file exists, false after", async () => {
    expect(await deleteLogo("with-logo", "horizontal.svg")).toBe(true);
    expect(await deleteLogo("with-logo", "horizontal.svg")).toBe(false);
  });

  test("rejects path-traversal filenames", async () => {
    await expect(writeLogo("with-logo", "../evil.svg", Buffer.from("x"))).rejects.toThrow();
    await expect(deleteLogo("with-logo", "../evil.svg")).rejects.toThrow();
  });

  test("rejects null bytes in filenames", async () => {
    await expect(writeLogo("with-logo", "a\x00b.svg", Buffer.from("x"))).rejects.toThrow();
  });

  test("rejects invalid slugs", async () => {
    await expect(writeLogo("Has Spaces", "ok.svg", Buffer.from("x"))).rejects.toThrow();
  });
});
