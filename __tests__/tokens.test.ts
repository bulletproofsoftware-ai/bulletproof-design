import { describe, expect, it } from "@jest/globals";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const STYLES_DIR = resolve(import.meta.dirname ?? __dirname, "..", "src", "styles");

describe("Design Token Pipeline", () => {
  describe("tokens.css", () => {
    const cssPath = resolve(STYLES_DIR, "tokens.css");

    it("exists", () => {
      expect(existsSync(cssPath)).toBe(true);
    });

    it("contains --ds-brand-primary custom property", () => {
      const css = readFileSync(cssPath, "utf8");
      expect(css).toContain("--ds-brand-primary");
    });

    it('contains [data-theme="dark"] selector', () => {
      const css = readFileSync(cssPath, "utf8");
      expect(css).toContain('[data-theme="dark"]');
    });

    it('contains [data-theme="high-contrast"] selector', () => {
      const css = readFileSync(cssPath, "utf8");
      expect(css).toContain('[data-theme="high-contrast"]');
    });

    it("contains all 9 token categories", () => {
      const css = readFileSync(cssPath, "utf8");
      const categories = [
        "brand",
        "surface",
        "text",
        "border",
        "status",
        "radius",
        "spacing",
        "shadow",
        "motion",
      ];
      for (const cat of categories) {
        expect(css).toContain(`--ds-${cat}-`);
      }
    });
  });

  describe("tokens.ts", () => {
    const tsPath = resolve(STYLES_DIR, "tokens.ts");

    it("exists", () => {
      expect(existsSync(tsPath)).toBe(true);
    });

    it("exports a tokens object with all 9 categories", () => {
      const ts = readFileSync(tsPath, "utf8");
      expect(ts).toContain("export const tokens");
      const categories = [
        "brand",
        "surface",
        "text",
        "border",
        "status",
        "radius",
        "spacing",
        "shadow",
        "motion",
      ];
      for (const cat of categories) {
        expect(ts).toContain(`export const ${cat}`);
      }
    });
  });

  describe("tokens.json", () => {
    const jsonPath = resolve(STYLES_DIR, "tokens.json");

    it("exists", () => {
      expect(existsSync(jsonPath)).toBe(true);
    });

    it("is valid JSON", () => {
      const raw = readFileSync(jsonPath, "utf8");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it("contains all 9 token categories as key prefixes", () => {
      const raw = readFileSync(jsonPath, "utf8");
      const data = JSON.parse(raw);
      const keys = Object.keys(data);
      const categories = [
        "ds-brand-",
        "ds-surface-",
        "ds-text-",
        "ds-border-",
        "ds-status-",
        "ds-radius-",
        "ds-spacing-",
        "ds-shadow-",
        "ds-motion-",
      ];
      for (const prefix of categories) {
        expect(keys.some((k: string) => k.startsWith(prefix))).toBe(true);
      }
    });
  });
});
