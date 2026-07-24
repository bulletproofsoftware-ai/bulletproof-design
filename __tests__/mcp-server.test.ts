/**
 * MCP server tool handler tests.
 *
 * Legacy handlers (get_component, search_components, get_asset, get_tokens,
 * get_composition_rules) hit the real on-disk registries & token files via
 * the project root, so they need no fixture setup.
 *
 * New handlers (get_brand_identity, get_brand_guidelines, get_component_spec,
 * search_icons, get_icon) are tested against isolated temp fixtures. We set
 * `process.env.BRANDS_DIR` and `process.env.ICONS_DIR` *before* importing the
 * server module so the module-level path resolution picks them up.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Fixture dirs — set env vars BEFORE importing the server module.
// ---------------------------------------------------------------------------

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-server-test-"));
const FIXTURE_BRANDS_DIR = path.join(TMP_ROOT, "brands");
const FIXTURE_ICONS_DIR = path.join(TMP_ROOT, "icons");

fs.mkdirSync(FIXTURE_BRANDS_DIR, { recursive: true });
fs.mkdirSync(FIXTURE_ICONS_DIR, { recursive: true });

// ─── Brand fixtures ────────────────────────────────────────────────────
// A directory-format brand with guidelines.md and a flat brand without.
const sampleBrandDir = path.join(FIXTURE_BRANDS_DIR, "sample");
fs.mkdirSync(sampleBrandDir, { recursive: true });
fs.writeFileSync(
  path.join(sampleBrandDir, "brand.json"),
  JSON.stringify(
    {
      name: "Sample",
      slug: "sample",
      description: "Test brand used by MCP server tests",
      colors: {
        primary: "#3b82f6",
        secondary: "#f1f5f9",
      },
      fonts: { heading: "Inter", body: "Inter" },
      typography: {
        headings: {
          family: "Inter",
          weights: [400, 700],
          scale: { h1: { size: "2.5rem", lineHeight: "1.2", weight: 700 } },
        },
      },
      logos: {
        horizontal: {
          file: "logo-horizontal.svg",
          label: "Horizontal logo",
          usage: "Header, email signature",
          preferred: true,
        },
      },
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(sampleBrandDir, "guidelines.md"),
  `---
sections:
  - slug: logo-usage
    title: Logo Usage
  - slug: color-usage
    title: Color Usage
---

## Logo Usage

Always maintain clear space around the logo.

### Do
- Use the horizontal logo on light backgrounds
- Respect minimum size guidelines

### Don't
- Stretch or distort the logo
- Use unapproved color variants

## Color Usage

Use our primary palette.
`,
);

// Flat brand — demonstrates the legacy shape.
fs.writeFileSync(
  path.join(FIXTURE_BRANDS_DIR, "flat-brand.json"),
  JSON.stringify(
    {
      name: "Flat Brand",
      slug: "flat-brand",
      colors: { primary: "#ef4444" },
      fonts: { heading: "Inter", body: "Inter" },
      logo: { mark: "mark.svg", horizontal: "horizontal.svg" },
    },
    null,
    2,
  ),
);

// ─── Icon fixtures ──────────────────────────────────────────────────────
fs.mkdirSync(path.join(FIXTURE_ICONS_DIR, "outlined"), { recursive: true });
fs.mkdirSync(path.join(FIXTURE_ICONS_DIR, "rounded"), { recursive: true });
fs.mkdirSync(path.join(FIXTURE_ICONS_DIR, "sharp"), { recursive: true });

const fixtureMetadata = {
  version: "1.0.0",
  source: "google/material-design-icons",
  generated: "2026-04-17T00:00:00.000Z",
  icons: [
    {
      name: "home",
      category: "action",
      tags: ["action", "home", "house"],
      aliases: ["house", "residence", "home"],
      styles: ["outlined", "rounded", "sharp"],
    },
    {
      name: "search",
      category: "action",
      tags: ["action", "search", "find"],
      aliases: ["find", "magnify", "search"],
      styles: ["outlined", "rounded"],
    },
    {
      name: "home_work",
      category: "social",
      tags: ["social", "home", "work"],
      aliases: ["home", "work"],
      styles: ["outlined"],
    },
  ],
};
fs.writeFileSync(
  path.join(FIXTURE_ICONS_DIR, "metadata.json"),
  JSON.stringify(fixtureMetadata),
);

const fixtureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>';
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "outlined", "home.svg"), fixtureSvg);
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "rounded", "home.svg"), fixtureSvg);
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "sharp", "home.svg"), fixtureSvg);
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "outlined", "search.svg"), fixtureSvg);
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "rounded", "search.svg"), fixtureSvg);
fs.writeFileSync(path.join(FIXTURE_ICONS_DIR, "outlined", "home_work.svg"), fixtureSvg);

// Set env vars so the server module resolves to our fixture dirs.
// The server uses `resolve(PROJECT_ROOT, process.env.BRANDS_DIR ?? "brands")`.
// Providing an absolute path bypasses the project-root join.
process.env.BRANDS_DIR = FIXTURE_BRANDS_DIR;
process.env.ICONS_DIR = FIXTURE_ICONS_DIR;

// Must be a dynamic import so env vars are read after they're set.
const serverModule = await import("../src/mcp/design-system-server.js");

const {
  handleGetComponent,
  handleSearchComponents,
  handleGetAsset,
  handleGetTokens,
  handleGetCompositionRules,
  handleGetBrandIdentity,
  handleGetBrandGuidelines,
  handleGetComponentSpec,
  handleSearchIcons,
  handleGetIcon,
  createServer,
  __resetMcpIndexesForTests,
} = serverModule;

beforeAll(() => {
  __resetMcpIndexesForTests();
});

afterAll(() => {
  if (TMP_ROOT) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Legacy tools — preserved for REQ-044 no-regression
// ---------------------------------------------------------------------------

describe("MCP server module", () => {
  it("can be imported and creates a server without errors", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});

describe("get_component (legacy)", () => {
  it("returns the Button entry (case-insensitive)", async () => {
    const result = await handleGetComponent({ name: "Button" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("button");
    expect(data.tier).toBe("ui");
  });

  it("returns the button entry with lowercase input", async () => {
    const result = await handleGetComponent({ name: "button" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("button");
  });

  it("returns error for nonexistent component", async () => {
    const result = await handleGetComponent({ name: "nonexistent" });
    expect(result.content[0].text).toContain("Component not found");
  });
});

describe("search_components (legacy)", () => {
  it("returns Button when searching 'button'", async () => {
    const result = await handleSearchComponents({ query: "button" });
    const data = JSON.parse(result.content[0].text);
    expect(data.length).toBeGreaterThan(0);
    const names = data.map((c: { name: string }) => c.name.toLowerCase());
    expect(names).toContain("button");
  });

  it("filters by tier", async () => {
    const result = await handleSearchComponents({
      query: "card",
      tier: "features",
    });
    const data = JSON.parse(result.content[0].text);
    for (const c of data) {
      expect(c.tier).toBe("features");
    }
  });

  it("returns empty array for no matches", async () => {
    const result = await handleSearchComponents({
      query: "zzzznonexistentzzzz",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });
});

describe("get_asset (legacy)", () => {
  it("returns the bulletproof-mark asset", async () => {
    const result = await handleGetAsset({ name: "bulletproof-mark" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("bulletproof-mark");
    expect(data.category).toBe("brand");
  });

  it("returns error for nonexistent asset", async () => {
    const result = await handleGetAsset({ name: "nonexistent" });
    expect(result.content[0].text).toContain("Asset not found");
  });
});

describe("get_tokens (legacy)", () => {
  it("returns brand tokens only when category specified", async () => {
    const result = await handleGetTokens({ category: "brand" });
    const data = JSON.parse(result.content[0].text);
    expect(Object.keys(data)).toEqual(["brand"]);
    expect(data.brand.primary).toBeDefined();
  });

  it("returns all tokens when no filters", async () => {
    const result = await handleGetTokens({});
    const data = JSON.parse(result.content[0].text);
    expect(data.brand).toBeDefined();
    expect(data.surface).toBeDefined();
    expect(data.text).toBeDefined();
  });

  it("returns merged dark theme", async () => {
    const result = await handleGetTokens({ theme: "dark" });
    const data = JSON.parse(result.content[0].text);
    expect(data.brand.primary.$value).toBe("#60a5fa");
    expect(data.spacing).toBeDefined();
  });

  it("returns error for nonexistent theme", async () => {
    const result = await handleGetTokens({ theme: "nonexistent" });
    expect(result.content[0].text).toContain("Theme not found");
  });

  it("returns error for nonexistent category", async () => {
    const result = await handleGetTokens({ category: "nonexistent" });
    expect(result.content[0].text).toContain("Category not found");
  });
});

describe("get_composition_rules (legacy)", () => {
  it("returns correct rules for features tier", async () => {
    const result = await handleGetCompositionRules({ tier: "features" });
    const data = JSON.parse(result.content[0].text);
    expect(data.tier).toBe("features");
    expect(data.allowedImports).toContain("primitives/");
    expect(data.allowedImports).toContain("Cannot import from other features");
  });

  it("returns correct rules for ui tier", async () => {
    const result = await handleGetCompositionRules({ tier: "ui" });
    const data = JSON.parse(result.content[0].text);
    expect(data.allowedImports).toBe("External packages only");
  });

  it("returns error for unknown tier", async () => {
    const result = await handleGetCompositionRules({ tier: "unknown" });
    expect(result.content[0].text).toContain("Unknown tier");
  });
});

// ---------------------------------------------------------------------------
// New tools (REQ-045..REQ-049)
// ---------------------------------------------------------------------------

describe("get_brand_identity (REQ-045)", () => {
  it("returns colors, typography, logos, fonts for a directory brand", async () => {
    const result = await handleGetBrandIdentity({ slug: "sample" });
    const data = JSON.parse(result.content[0].text);
    expect(data.slug).toBe("sample");
    expect(data.name).toBe("Sample");
    expect(data.colors.primary).toBe("#3b82f6");
    expect(data.typography.headings.family).toBe("Inter");
    expect(data.logos.horizontal.file).toBe("logo-horizontal.svg");
    expect(data.fonts.heading).toBe("Inter");
  });

  it("returns legacy `logo` field for flat brands without `logos`", async () => {
    const result = await handleGetBrandIdentity({ slug: "flat-brand" });
    const data = JSON.parse(result.content[0].text);
    expect(data.slug).toBe("flat-brand");
    // logo.mark is the legacy field; handler falls back to `brand.logo` when
    // `brand.logos` is undefined.
    expect(data.logos.mark).toBe("mark.svg");
    expect(data.typography).toBeNull();
  });

  it("returns error for unknown slug", async () => {
    const result = await handleGetBrandIdentity({ slug: "does-not-exist" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Brand not found");
    expect(data.slug).toBe("does-not-exist");
  });

  it("rejects invalid slugs", async () => {
    const result = await handleGetBrandIdentity({ slug: "../../etc/passwd" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid brand slug");
  });

  it("rejects uppercase slugs", async () => {
    const result = await handleGetBrandIdentity({ slug: "Sample" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid brand slug");
  });
});

describe("get_brand_guidelines (REQ-046)", () => {
  it("returns all parsed sections by default", async () => {
    const result = await handleGetBrandGuidelines({ slug: "sample" });
    const data = JSON.parse(result.content[0].text);
    expect(data.slug).toBe("sample");
    expect(Array.isArray(data.sections)).toBe(true);
    const slugs = data.sections.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain("logo-usage");
    expect(slugs).toContain("color-usage");
    // Declared sections reconciliation should have no missing warnings.
    expect(data.warnings).toBeDefined();
  });

  it("returns only the requested section", async () => {
    const result = await handleGetBrandGuidelines({
      slug: "sample",
      section: "logo-usage",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.slug).toBe("sample");
    expect(data.section.slug).toBe("logo-usage");
    expect(data.section.title).toBe("Logo Usage");
    // Dos/donts should be extracted.
    expect(data.section.dos.length).toBeGreaterThan(0);
    expect(data.section.donts.length).toBeGreaterThan(0);
  });

  it("returns error for nonexistent section", async () => {
    const result = await handleGetBrandGuidelines({
      slug: "sample",
      section: "nonexistent",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Section not found");
    expect(data.section).toBe("nonexistent");
    expect(Array.isArray(data.available)).toBe(true);
  });

  it("returns error when guidelines.md is missing", async () => {
    const result = await handleGetBrandGuidelines({ slug: "flat-brand" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("guidelines.md not found");
    expect(data.slug).toBe("flat-brand");
  });

  it("rejects path-traversal slugs", async () => {
    const result = await handleGetBrandGuidelines({ slug: "../sample" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid brand slug");
  });

  it("rejects malformed section slugs", async () => {
    const result = await handleGetBrandGuidelines({
      slug: "sample",
      section: "../../etc",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid section slug");
  });
});

describe("get_component_spec (REQ-047)", () => {
  it("returns a full enriched spec for Button", async () => {
    const result = await handleGetComponentSpec({ name: "Button" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name.toLowerCase()).toBe("button");
    expect(data.tier).toBe("ui");
    // The spec shape exposes deps/variants when present.
    expect(data).toHaveProperty("path");
  });

  it("is case-insensitive", async () => {
    const result = await handleGetComponentSpec({ name: "BUTTON" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name.toLowerCase()).toBe("button");
  });

  it("returns error for unknown component", async () => {
    const result = await handleGetComponentSpec({ name: "DoesNotExist" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Component not found");
    expect(data.name).toBe("DoesNotExist");
  });

  it("rejects empty names", async () => {
    const result = await handleGetComponentSpec({ name: "" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid component name");
  });
});

describe("search_icons (REQ-048)", () => {
  it("returns icons matching a query", async () => {
    const result = await handleSearchIcons({ query: "home" });
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBeGreaterThan(0);
    const names = data.items.map((i: { name: string }) => i.name);
    expect(names).toContain("home");
    // home_work matches on tag/alias.
    expect(names).toContain("home_work");
  });

  it("filters by style", async () => {
    const result = await handleSearchIcons({ query: "home", style: "sharp" });
    const data = JSON.parse(result.content[0].text);
    for (const icon of data.items) {
      expect(icon.styles).toContain("sharp");
    }
  });

  it("filters by category", async () => {
    const result = await handleSearchIcons({
      query: "home",
      category: "social",
    });
    const data = JSON.parse(result.content[0].text);
    for (const icon of data.items) {
      expect(icon.category).toBe("social");
    }
  });

  it("returns empty items for no matches", async () => {
    const result = await handleSearchIcons({ query: "zzzznonexistentzzzz" });
    const data = JSON.parse(result.content[0].text);
    expect(data.total).toBe(0);
    expect(data.items).toEqual([]);
  });

  it("rejects invalid styles", async () => {
    const result = await handleSearchIcons({
      query: "home",
      style: "invalid",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid style");
  });
});

describe("get_icon (REQ-049)", () => {
  it("returns SVG + metadata for a valid icon", async () => {
    const result = await handleGetIcon({ name: "home", style: "outlined" });
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("home");
    expect(data.style).toBe("outlined");
    expect(data.category).toBe("action");
    expect(data.svg).toContain("<svg");
    expect(Array.isArray(data.tags)).toBe(true);
    expect(Array.isArray(data.aliases)).toBe(true);
    expect(data.availableStyles).toEqual(["outlined", "rounded", "sharp"]);
  });

  it("defaults to the outlined style when none provided", async () => {
    const result = await handleGetIcon({ name: "home" });
    const data = JSON.parse(result.content[0].text);
    expect(data.style).toBe("outlined");
    expect(data.svg).toContain("<svg");
  });

  it("returns error for unknown icon name", async () => {
    const result = await handleGetIcon({ name: "nonexistent_icon" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Icon not found");
    expect(data.name).toBe("nonexistent_icon");
  });

  it("returns error for a style not available for that icon", async () => {
    // home_work only ships in outlined.
    const result = await handleGetIcon({ name: "home_work", style: "sharp" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Style not available for this icon");
    expect(data.available).toEqual(["outlined"]);
  });

  it("rejects invalid style values", async () => {
    const result = await handleGetIcon({ name: "home", style: "invalid" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid style");
  });

  it("rejects path-traversal icon names", async () => {
    const result = await handleGetIcon({ name: "../etc/passwd" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid icon name");
  });

  it("rejects uppercase / hyphenated names", async () => {
    const result = await handleGetIcon({ name: "Home" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("Invalid icon name");
    const result2 = await handleGetIcon({ name: "home-work" });
    const data2 = JSON.parse(result2.content[0].text);
    expect(data2.error).toBe("Invalid icon name");
  });
});
