/**
 * Unit tests for brand index — loading, querying, CSS generation.
 *
 * Covers the legacy flat-file path. A separate
 * `brandIndex.directory.test.ts` exercises the directory format.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  buildBrandIndex,
  getAll,
  getBySlug,
  getBrandColors,
  getBrandFonts,
  generateCssVariables,
  isRoleGroupedColors,
  closeWatcher,
  BrandColors,
} from "../src/api/lib/brandIndex";

const TMP_DIR = path.join(os.tmpdir(), "design-lib-brand-test");

const SAMPLE_BRAND = {
  name: "Test Brand",
  slug: "test-brand",
  description: "A test brand",
  logo: { mark: "mark.png", horizontal: "horizontal.png", favicon: "favicon.png" },
  colors: {
    primary: "#3b82f6",
    secondary: "#1e293b",
    accent: "#10b981",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    error: "#ef4444",
    warning: "#f59e0b",
    success: "#22c55e",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96] },
  borderRadius: { small: "4px", medium: "8px", large: "12px", full: "9999px" },
  shadows: {
    small: "0 1px 2px rgba(0,0,0,0.05)",
    medium: "0 4px 6px rgba(0,0,0,0.07)",
    large: "0 10px 15px rgba(0,0,0,0.1)",
  },
};

const SECOND_BRAND = {
  ...SAMPLE_BRAND,
  name: "Another Brand",
  slug: "another-brand",
  colors: { ...SAMPLE_BRAND.colors, primary: "#ef4444" },
};

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, "test-brand.json"), JSON.stringify(SAMPLE_BRAND), "utf-8");
  fs.writeFileSync(path.join(TMP_DIR, "another-brand.json"), JSON.stringify(SECOND_BRAND), "utf-8");
  buildBrandIndex(TMP_DIR);
});

afterAll(() => {
  closeWatcher();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("getAll", () => {
  test("returns all brands with summary info", () => {
    const all = getAll();
    expect(all.length).toBe(2);
    expect(all[0]).toHaveProperty("name");
    expect(all[0]).toHaveProperty("slug");
    expect(all[0]).toHaveProperty("description");
    expect(all[0]).toHaveProperty("primaryColor");
  });

  test("brands are sorted alphabetically", () => {
    const all = getAll();
    expect(all[0].name).toBe("Another Brand");
    expect(all[1].name).toBe("Test Brand");
  });
});

describe("getBySlug", () => {
  test("returns full brand config for valid slug", () => {
    const brand = getBySlug("test-brand");
    expect(brand).toBeDefined();
    expect(brand!.name).toBe("Test Brand");
    // colors is a union now — narrow with the guard for the flat case.
    expect(isRoleGroupedColors(brand!.colors)).toBe(false);
    expect((brand!.colors as BrandColors).primary).toBe("#3b82f6");
    expect(brand!.fonts.heading).toBe("Inter");
  });

  test("returns undefined for invalid slug", () => {
    expect(getBySlug("nonexistent")).toBeUndefined();
  });

  test("flat brands are marked with _source=flat", () => {
    const brand = getBySlug("test-brand");
    expect(brand?._source).toBe("flat");
  });
});

describe("getBrandColors", () => {
  test("returns colors for valid slug", () => {
    const colors = getBrandColors("test-brand") as BrandColors | undefined;
    expect(colors).toBeDefined();
    expect(colors!.primary).toBe("#3b82f6");
    expect(colors!.error).toBe("#ef4444");
  });

  test("returns undefined for invalid slug", () => {
    expect(getBrandColors("nonexistent")).toBeUndefined();
  });
});

describe("getBrandFonts", () => {
  test("returns fonts for valid slug", () => {
    const fonts = getBrandFonts("test-brand");
    expect(fonts).toBeDefined();
    expect(fonts!.heading).toBe("Inter");
    expect(fonts!.mono).toBe("JetBrains Mono");
  });

  test("returns undefined for invalid slug", () => {
    expect(getBrandFonts("nonexistent")).toBeUndefined();
  });
});

describe("generateCssVariables (flat brand)", () => {
  test("generates CSS custom properties for valid brand", () => {
    const css = generateCssVariables("test-brand");
    expect(css).toBeDefined();
    expect(css).toContain(":root {");
    expect(css).toContain("--brand-primary: #3b82f6");
    expect(css).toContain("--brand-secondary: #1e293b");
    expect(css).toContain("--brand-font-heading: 'Inter', sans-serif");
    expect(css).toContain("--brand-font-mono: 'JetBrains Mono', monospace");
    expect(css).toContain("--brand-radius-sm: 4px");
    expect(css).toContain("--brand-spacing-unit: 4px");
    expect(css).toContain("}");
  });

  test("returns undefined for invalid slug", () => {
    expect(generateCssVariables("nonexistent")).toBeUndefined();
  });
});
