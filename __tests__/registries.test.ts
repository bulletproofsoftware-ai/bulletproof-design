import { describe, expect, it, beforeAll } from "@jest/globals";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";
import { glob } from "glob";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const ASSET_REGISTRY_PATH = resolve(ROOT, "src", "assets", "registry.json");
const ASSET_SCHEMA_PATH = resolve(ROOT, "src", "assets", "registry.schema.json");
const COMPONENT_REGISTRY_PATH = resolve(ROOT, "src", "components", "registry.json");
const COMPONENT_SCHEMA_PATH = resolve(ROOT, "src", "components", "registry.schema.json");
const ASSETS_DIR = resolve(ROOT, "assets");
const COMPONENTS_DIR = resolve(ROOT, "components");

beforeAll(() => {
  // Run generators to ensure registries are up to date
  execFileSync("npx", ["tsx", "scripts/generate-asset-registry.ts"], {
    cwd: ROOT,
    stdio: "pipe",
  });
  execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
    cwd: ROOT,
    stdio: "pipe",
  });
}, 30000);

describe("Asset Registry", () => {
  let registry: { assets: Array<Record<string, unknown>> };
  let schema: Record<string, unknown>;

  beforeAll(() => {
    registry = JSON.parse(readFileSync(ASSET_REGISTRY_PATH, "utf8"));
    schema = JSON.parse(readFileSync(ASSET_SCHEMA_PATH, "utf8"));
  });

  it("produces valid JSON output", () => {
    expect(registry).toBeDefined();
    expect(registry.assets).toBeInstanceOf(Array);
    expect(registry.assets.length).toBeGreaterThan(0);
  });

  it("has required fields on every asset entry", () => {
    const required = (schema as any).properties.assets.items.required as string[];
    for (const asset of registry.assets) {
      for (const field of required) {
        expect(asset).toHaveProperty(field);
        expect(asset[field]).not.toBeNull();
        expect(asset[field]).not.toBeUndefined();
      }
    }
  });

  it("every asset file in assets/ is represented in the registry", async () => {
    const files = await glob("**/*", {
      cwd: ASSETS_DIR,
      nodir: true,
      ignore: ["**/.gitkeep"],
    });
    const registryFiles = new Set(registry.assets.map((a) => a.file));
    for (const file of files) {
      expect(registryFiles).toContain(file);
    }
  });

  it("has no stale entries (registry entry exists but file does not)", () => {
    for (const asset of registry.assets) {
      const absPath = resolve(ASSETS_DIR, asset.file as string);
      expect(existsSync(absPath)).toBe(true);
    }
  });

  it("has valid format values (file extension)", () => {
    for (const asset of registry.assets) {
      expect(typeof asset.format).toBe("string");
      expect((asset.format as string).length).toBeGreaterThan(0);
    }
  });

  it("has valid size values", () => {
    for (const asset of registry.assets) {
      expect(typeof asset.size).toBe("string");
      expect(asset.size).toMatch(/^\d+(\.\d+)?(B|KB|MB|GB)$/);
    }
  });

  it("has no incomplete entries when metadata is complete", () => {
    const incomplete = registry.assets.filter((a) => a.incomplete === true);
    expect(incomplete).toEqual([]);
  });
});

describe("Component Registry", () => {
  let registry: { components: Array<Record<string, unknown>> };
  let schema: Record<string, unknown>;

  beforeAll(() => {
    registry = JSON.parse(readFileSync(COMPONENT_REGISTRY_PATH, "utf8"));
    schema = JSON.parse(readFileSync(COMPONENT_SCHEMA_PATH, "utf8"));
  });

  it("produces valid JSON output", () => {
    expect(registry).toBeDefined();
    expect(registry.components).toBeInstanceOf(Array);
    expect(registry.components.length).toBeGreaterThan(0);
  });

  it("has required fields on every component entry", () => {
    const required = (schema as any).properties.components.items.required as string[];
    for (const comp of registry.components) {
      for (const field of required) {
        expect(comp).toHaveProperty(field);
        expect(comp[field]).not.toBeNull();
        expect(comp[field]).not.toBeUndefined();
      }
    }
  });

  it("every component .tsx file is represented in the registry", async () => {
    const tiers = ["ui", "primitives", "features", "effects"];
    const registryPaths = new Set(registry.components.map((c) => c.path));

    for (const tier of tiers) {
      const tierDir = resolve(COMPONENTS_DIR, tier);
      if (!existsSync(tierDir)) continue;

      const files = await glob("**/*.tsx", {
        cwd: tierDir,
        nodir: true,
        ignore: ["**/index.ts", "**/index.tsx"],
      });

      for (const file of files) {
        const relPath = `components/${tier}/${file}`;
        expect(registryPaths).toContain(relPath);
      }
    }
  });

  it("has no stale entries (registry entry exists but file does not)", () => {
    for (const comp of registry.components) {
      const absPath = resolve(ROOT, comp.path as string);
      expect(existsSync(absPath)).toBe(true);
    }
  });

  it("has valid tier values", () => {
    const validTiers = (schema as any).properties.components.items.properties.tier.enum;
    for (const comp of registry.components) {
      expect(validTiers).toContain(comp.tier);
    }
  });

  it("client field is a boolean", () => {
    for (const comp of registry.components) {
      expect(typeof comp.client).toBe("boolean");
    }
  });

  it("has no incomplete entries when metadata is complete", () => {
    const incomplete = registry.components.filter((c) => c.incomplete === true);
    expect(incomplete).toEqual([]);
  });

  it("detects use client directive correctly for known client components", () => {
    // Known client components that use hooks or browser APIs
    const knownClientNames = ["Nav", "Sidebar", "SearchCommand", "LivePreview", "MonacoEditor",
      "ColorPicker", "ConfirmDialog", "FontPicker", "IconButton", "TagInput",
      "AssetCard", "BrandCard", "Breadcrumbs"];
    const knownClientLower = new Set(knownClientNames.map((n) => n.toLowerCase()));

    for (const comp of registry.components) {
      if (knownClientLower.has((comp.name as string).toLowerCase())) {
        expect(comp.client).toBe(true);
      }
    }
  });
});
