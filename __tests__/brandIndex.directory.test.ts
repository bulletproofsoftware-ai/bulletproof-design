/**
 * Directory-format brand loading tests.
 *
 * Covers REQ-001, REQ-051, REQ-053, REQ-054 behaviours:
 *  - directory-format brands load identically to flat brands
 *  - expanded role-grouped colors are preserved
 *  - directory wins over flat file when both exist (with a warning)
 *  - CSS variables emit `--color-<group>-<name>` keys for role-grouped brands
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  buildBrandIndex,
  getAll,
  getBySlug,
  getBrandColors,
  generateCssVariables,
  isRoleGroupedColors,
  extractPrimaryColor,
  _rebuildForTest,
  closeWatcher,
} from "../src/api/lib/brandIndex";

const TMP_DIR = fs.mkdtempSync(fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-brand-dir-test-")));

// ────────────────────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────────────────────

// A directory-format brand with role-grouped colors (REQ-003).
const DIRECTORY_BRAND = {
  name: "Directory Brand",
  slug: "directory-brand",
  description: "A brand stored in directory form",
  colors: {
    primary: {
      blue: { hex: "#0057B8", rgb: [0, 87, 184], role: "Primary" },
    },
    medium: {
      teal: { hex: "#009CA6", rgb: [0, 156, 166], role: "Support" },
    },
    light: {
      sand: { hex: "#EFE4C9", rgb: [239, 228, 201], role: "Neutral warm" },
    },
    neutral: {}, // empty group — must not crash the guard
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 16, 24, 32] },
  borderRadius: { small: "4px", medium: "8px", large: "16px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
  logos: {
    horizontal: {
      file: "horizontal.svg",
      label: "Horizontal",
      usage: "Default in most contexts",
      preferred: true,
    },
    icon: { file: "icon.svg", label: "Icon", usage: "Favicons and small UI" },
  },
  typography: {
    headings: {
      family: "Inter",
      weights: [400, 600, 700],
      scale: {
        h1: { size: "3rem", lineHeight: "1.1", weight: 700 },
      },
    },
  },
};

// A flat brand (legacy format) — used to confirm both formats coexist.
const FLAT_BRAND = {
  name: "Legacy Flat",
  slug: "legacy-flat",
  description: "A brand in the old flat format",
  logo: { mark: "", horizontal: "", favicon: "" },
  colors: {
    primary: "#ef4444",
    secondary: "#f8fafc",
    accent: "#10b981",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    error: "#dc2626",
    warning: "#f59e0b",
    success: "#22c55e",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "Mono" },
  spacing: { unit: 4, scale: [0, 4, 8] },
  borderRadius: { small: "4px", medium: "8px", large: "12px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
};

// A brand that exists in both formats — directory must win.
const CONFLICT_DIR = {
  ...DIRECTORY_BRAND,
  name: "Conflict Directory",
  slug: "conflict",
};
const CONFLICT_FLAT = {
  ...FLAT_BRAND,
  name: "Conflict Flat",
  slug: "conflict",
};

beforeAll(() => {
  // Directory brand
  const dirBrandPath = path.join(TMP_DIR, "directory-brand");
  fs.mkdirSync(path.join(dirBrandPath, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(dirBrandPath, "brand.json"),
    JSON.stringify(DIRECTORY_BRAND),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(dirBrandPath, "guidelines.md"),
    "# Authored guidelines\n",
    "utf-8",
  );

  // Flat brand
  fs.writeFileSync(
    path.join(TMP_DIR, "legacy-flat.json"),
    JSON.stringify(FLAT_BRAND),
    "utf-8",
  );

  // Conflict — both formats present
  const conflictDir = path.join(TMP_DIR, "conflict");
  fs.mkdirSync(conflictDir, { recursive: true });
  fs.writeFileSync(
    path.join(conflictDir, "brand.json"),
    JSON.stringify(CONFLICT_DIR),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(TMP_DIR, "conflict.json"),
    JSON.stringify(CONFLICT_FLAT),
    "utf-8",
  );

  buildBrandIndex(TMP_DIR);
});

afterAll(() => {
  closeWatcher();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

describe("buildBrandIndex (directory format)", () => {
  test("loads directory-format brand alongside flat brand", () => {
    const all = getAll();
    const slugs = all.map((b) => b.slug).sort();
    // Expected: conflict (directory wins), directory-brand, legacy-flat
    expect(slugs).toEqual(["conflict", "directory-brand", "legacy-flat"]);
  });

  test("directory brand's _source is 'directory'", () => {
    const brand = getBySlug("directory-brand");
    expect(brand?._source).toBe("directory");
  });

  test("flat brand's _source is 'flat'", () => {
    const brand = getBySlug("legacy-flat");
    expect(brand?._source).toBe("flat");
  });

  test("directory wins over flat file for conflicting slug", () => {
    // Directory loaded into the index — so the directory name/content wins.
    const brand = getBySlug("conflict");
    expect(brand).toBeDefined();
    expect(brand?._source).toBe("directory");
    expect(brand?.name).toBe("Conflict Directory");
  });
});

describe("role-grouped color detection", () => {
  test("isRoleGroupedColors returns true for role-grouped brand", () => {
    const brand = getBySlug("directory-brand");
    expect(isRoleGroupedColors(brand!.colors)).toBe(true);
  });

  test("isRoleGroupedColors returns false for flat brand", () => {
    const brand = getBySlug("legacy-flat");
    expect(isRoleGroupedColors(brand!.colors)).toBe(false);
  });

  test("isRoleGroupedColors handles null/undefined/primitives", () => {
    expect(isRoleGroupedColors(null as any)).toBe(false);
    expect(isRoleGroupedColors(undefined as any)).toBe(false);
    expect(isRoleGroupedColors("string" as any)).toBe(false);
    expect(isRoleGroupedColors(42 as any)).toBe(false);
  });

  test("isRoleGroupedColors tolerates empty groups (all empty → false)", () => {
    // No entries anywhere → cannot prove role-grouped.
    expect(isRoleGroupedColors({ primary: {}, medium: {} })).toBe(false);
  });

  test("isRoleGroupedColors returns true when one group has entries and others empty", () => {
    expect(
      isRoleGroupedColors({
        primary: { a: { hex: "#000", rgb: [0, 0, 0], role: "x" } },
        medium: {},
      }),
    ).toBe(true);
  });

  test("extractPrimaryColor returns first primary-group hex for role-grouped brand", () => {
    const brand = getBySlug("directory-brand");
    expect(extractPrimaryColor(brand!.colors)).toBe("#0057B8");
  });

  test("extractPrimaryColor returns colors.primary for flat brand", () => {
    const brand = getBySlug("legacy-flat");
    expect(extractPrimaryColor(brand!.colors)).toBe("#ef4444");
  });
});

describe("getBrandColors (union shape)", () => {
  test("returns role-grouped object verbatim for directory brand", () => {
    const colors = getBrandColors("directory-brand");
    expect(colors).toBeDefined();
    expect(isRoleGroupedColors(colors!)).toBe(true);
    const rg = colors as any;
    expect(rg.primary.blue.hex).toBe("#0057B8");
  });

  test("returns flat object for legacy brand", () => {
    const colors = getBrandColors("legacy-flat") as Record<string, string>;
    expect(colors).toBeDefined();
    expect(colors.primary).toBe("#ef4444");
  });
});

describe("generateCssVariables (role-grouped)", () => {
  test("emits --color-<group>-<name> keys for role-grouped brand", () => {
    const css = generateCssVariables("directory-brand");
    expect(css).toBeDefined();
    expect(css).toContain(":root {");
    expect(css).toContain("--color-primary-blue: #0057B8;");
    expect(css).toContain("--color-primary-blue-rgb: 0, 87, 184;");
    expect(css).toContain("--color-medium-teal: #009CA6;");
    expect(css).toContain("--color-light-sand: #EFE4C9;");
    // Empty group must not emit anything.
    expect(css).not.toContain("--color-neutral-");
    // Fonts/spacing still use --brand- prefix
    expect(css).toContain("--brand-font-heading: 'Inter', sans-serif");
    expect(css).toContain("--brand-spacing-unit: 4px;");
  });

  test("still emits --brand-<name> keys for flat brand", () => {
    const css = generateCssVariables("legacy-flat");
    expect(css).toBeDefined();
    expect(css).toContain("--brand-primary: #ef4444");
    expect(css).toContain("--brand-secondary: #f8fafc");
  });
});

describe("getAll primaryColor extraction", () => {
  test("picks first primary entry for role-grouped brand", () => {
    const all = getAll();
    const dir = all.find((b) => b.slug === "directory-brand");
    expect(dir?.primaryColor).toBe("#0057B8");
  });

  test("uses colors.primary for flat brand", () => {
    const all = getAll();
    const flat = all.find((b) => b.slug === "legacy-flat");
    expect(flat?.primaryColor).toBe("#ef4444");
  });
});

describe("_rebuildForTest helper", () => {
  test("rebuilds the index without installing a watcher", () => {
    // Remove the flat brand and rebuild.
    fs.unlinkSync(path.join(TMP_DIR, "legacy-flat.json"));
    _rebuildForTest(TMP_DIR);
    expect(getBySlug("legacy-flat")).toBeUndefined();
    expect(getBySlug("directory-brand")).toBeDefined();

    // Restore so other tests / describe blocks (if reordered) aren't harmed.
    fs.writeFileSync(
      path.join(TMP_DIR, "legacy-flat.json"),
      JSON.stringify(FLAT_BRAND),
      "utf-8",
    );
    _rebuildForTest(TMP_DIR);
  });
});
