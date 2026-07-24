/**
 * Unit tests for the component registry generator (SPEC-005 REQ-020, REQ-058).
 *
 * Verifies:
 *   - TSX prop extraction via the TypeScript compiler API
 *   - Destructured defaults are captured
 *   - Optional markers (`?:`) surface as `optional: true`
 *   - Idempotent: running the generator multiple times yields byte-identical output
 *   - Graceful fallback when extraction finds no props (backward compat)
 *
 * We drive the generator via execFileSync (no shell — prevents injection) and
 * compare the on-disk output across runs.
 */

import { readFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const REGISTRY = resolve(ROOT, "src", "components", "registry.json");

interface Prop {
  name: string;
  type: string;
  optional?: boolean;
  default?: string;
  description?: string;
}

interface Registry {
  components: Array<{
    name: string;
    tier: string;
    path: string;
    client: boolean;
    description?: string;
    guidelines?: { when?: string; whenNot?: string; notes?: string };
    props?: Prop[];
    variants?: Record<string, string[]>;
    dependencies?: string[];
    examples?: Array<{ label: string; code: string }>;
    accessibility?: Record<string, unknown>;
    incomplete?: boolean;
  }>;
}

function loadRegistry(): Registry {
  return JSON.parse(readFileSync(REGISTRY, "utf8")) as Registry;
}

/** Run the generator script via execFileSync. No shell → no injection surface. */
function runGenerator(): void {
  execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

describe("generate-registry (SPEC-005)", () => {
  beforeAll(() => {
    runGenerator();
  }, 30_000);

  describe("TSX prop extraction (REQ-020)", () => {
    test("extracts props from named interface declarations", () => {
      const reg = loadRegistry();
      const cp = reg.components.find((c) => c.name === "ColorPicker");
      expect(cp).toBeDefined();
      const names = (cp!.props ?? []).map((p) => p.name).sort();
      // ColorPickerProps has label, value, onChange.
      expect(names).toEqual(["label", "onChange", "value"]);
    });

    test("extracts prop types as TS type strings", () => {
      const reg = loadRegistry();
      const cp = reg.components.find((c) => c.name === "ColorPicker");
      const label = cp!.props!.find((p) => p.name === "label");
      expect(label).toBeDefined();
      expect(label!.type).toBe("string");

      const onChange = cp!.props!.find((p) => p.name === "onChange");
      expect(onChange!.type).toContain("=>");
      expect(onChange!.type).toContain("void");
    });

    test("detects optional props", () => {
      const reg = loadRegistry();
      const tagInput = reg.components.find((c) => c.name === "TagInput");
      expect(tagInput).toBeDefined();
      const placeholder = tagInput!.props!.find((p) => p.name === "placeholder");
      expect(placeholder).toBeDefined();
      expect(placeholder!.optional).toBe(true);

      const tags = tagInput!.props!.find((p) => p.name === "tags");
      expect(tags).toBeDefined();
      expect(tags!.optional).toBeUndefined();
    });

    test("captures destructured defaults (e.g., placeholder = 'Add tag...')", () => {
      const reg = loadRegistry();
      const tagInput = reg.components.find((c) => c.name === "TagInput");
      const placeholder = tagInput!.props!.find((p) => p.name === "placeholder");
      expect(placeholder!.default).toBe('"Add tag..."');
    });

    test("registry contains at least the expected tier coverage (REQ-058)", () => {
      const reg = loadRegistry();
      const tiers = new Set(reg.components.map((c) => c.tier));
      expect(tiers.has("ui")).toBe(true);
      expect(tiers.has("primitives")).toBe(true);
      expect(tiers.has("features")).toBe(true);
    });
  });

  describe("Guidelines enrichment (REQ-018)", () => {
    test("surfaces guidelines from registry-meta.yaml when present", () => {
      const reg = loadRegistry();
      const button = reg.components.find((c) => c.name === "button");
      expect(button).toBeDefined();
      expect(button!.guidelines).toBeDefined();
      expect(typeof button!.guidelines!.when).toBe("string");
      expect(button!.guidelines!.when!.length).toBeGreaterThan(0);
    });

    test("omits guidelines when the YAML entry does not define them", () => {
      const reg = loadRegistry();
      const noGuide = reg.components.find(
        (c) => c.tier === "features" && !c.guidelines,
      );
      expect(noGuide).toBeDefined();
      expect(noGuide!.guidelines).toBeUndefined();
    });
  });

  describe("Backward compatibility (REQ-058)", () => {
    test("components without a recognized props type still appear in the registry", () => {
      const reg = loadRegistry();
      // At least some entries will have no props (e.g., Nav, which uses no
      // explicit Props type). They must still be indexed and passed through.
      const withoutProps = reg.components.filter(
        (c) => !c.props || c.props.length === 0,
      );
      expect(withoutProps.length).toBeGreaterThan(0);
      for (const c of withoutProps) {
        expect(c.name).toBeDefined();
        expect(c.tier).toBeDefined();
        expect(c.path).toBeDefined();
      }
    });
  });

  describe("Idempotence (SPEC-005 acceptance criterion)", () => {
    test("running the generator twice yields byte-identical output", () => {
      const before = readFileSync(REGISTRY, "utf8");
      runGenerator();
      const after = readFileSync(REGISTRY, "utf8");
      expect(after).toBe(before);
    }, 30_000);

    test("three consecutive runs are all identical", () => {
      const snapshots: string[] = [];
      for (let i = 0; i < 3; i++) {
        runGenerator();
        snapshots.push(readFileSync(REGISTRY, "utf8"));
      }
      expect(snapshots[0]).toBe(snapshots[1]);
      expect(snapshots[1]).toBe(snapshots[2]);
    }, 60_000);
  });

  describe("File integrity", () => {
    test("registry.json exists and is non-empty", () => {
      expect(existsSync(REGISTRY)).toBe(true);
      expect(statSync(REGISTRY).size).toBeGreaterThan(0);
    });

    test("registry.json parses as valid JSON with components array", () => {
      const reg = loadRegistry();
      expect(Array.isArray(reg.components)).toBe(true);
      expect(reg.components.length).toBeGreaterThan(0);
    });
  });
});
