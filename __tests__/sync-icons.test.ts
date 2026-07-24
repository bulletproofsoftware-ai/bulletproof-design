/**
 * Unit tests for scripts/sync-icons.ts helpers.
 *
 * Does not exercise the real GitHub API — the `main()` flow is not invoked
 * here (it's guarded by a network fetcher that would require heavy mocking).
 * These tests focus on the deterministic pieces:
 *   - CLI parsing
 *   - Category map loading and prefix resolution
 *   - Alias / tag derivation
 *   - Schema validation of a synthetic metadata.json
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  parseArgs,
  loadCategoryMap,
  categoryFromPrefix,
  deriveAliases,
  deriveTags,
} from "../scripts/sync-icons";

let TMP_ROOT: string;

beforeAll(() => {
  TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "sync-icons-test-"));
  // Seed a minimal category-map.json
  fs.writeFileSync(
    path.join(TMP_ROOT, "category-map.json"),
    JSON.stringify({
      prefixes: {
        "arrow_": "navigation",
        "home": "action",
        "search": "action",
        "folder": "file",
      },
    }),
  );
});

afterAll(() => {
  if (TMP_ROOT) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe("parseArgs", () => {
  test("default options", () => {
    const opts = parseArgs([]);
    expect(opts.styles).toEqual(["outlined", "rounded", "sharp"]);
    expect(opts.concurrency).toBe(8);
    expect(opts.dryRun).toBe(false);
    expect(opts.limit).toBeUndefined();
  });

  test("--dry-run flag sets dryRun true", () => {
    const opts = parseArgs(["--dry-run"]);
    expect(opts.dryRun).toBe(true);
  });

  test("--styles=outlined,sharp narrows styles list", () => {
    const opts = parseArgs(["--styles=outlined,sharp"]);
    expect(opts.styles).toEqual(["outlined", "sharp"]);
  });

  test("--concurrency=16 is applied", () => {
    const opts = parseArgs(["--concurrency=16"]);
    expect(opts.concurrency).toBe(16);
  });

  test("--limit=25 is parsed to a number", () => {
    const opts = parseArgs(["--limit=25"]);
    expect(opts.limit).toBe(25);
  });

  test("rejects unknown argument", () => {
    expect(() => parseArgs(["--something-wrong"]))
      .toThrow(/Unknown argument/);
  });

  test("rejects invalid style value", () => {
    expect(() => parseArgs(["--styles=filled"]))
      .toThrow(/Unknown --styles value/);
  });

  test("rejects out-of-range concurrency", () => {
    expect(() => parseArgs(["--concurrency=0"]))
      .toThrow(/between 1 and 64/);
    expect(() => parseArgs(["--concurrency=1000"]))
      .toThrow(/between 1 and 64/);
  });

  test("rejects invalid limit", () => {
    expect(() => parseArgs(["--limit=0"]))
      .toThrow(/positive integer/);
    expect(() => parseArgs(["--limit=-5"]))
      .toThrow(/positive integer/);
  });
});

describe("loadCategoryMap", () => {
  test("loads from category-map.json", () => {
    const map = loadCategoryMap(TMP_ROOT);
    expect(map.prefixes["arrow_"]).toBe("navigation");
    expect(map.prefixes["home"]).toBe("action");
  });

  test("throws when category-map.json is missing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "no-cat-map-"));
    try {
      expect(() => loadCategoryMap(empty)).toThrow(/category-map\.json missing/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  test("throws when category-map.json is malformed", () => {
    const bad = fs.mkdtempSync(path.join(os.tmpdir(), "bad-cat-map-"));
    try {
      fs.writeFileSync(path.join(bad, "category-map.json"), JSON.stringify({ other: "shape" }));
      expect(() => loadCategoryMap(bad)).toThrow(/malformed/);
    } finally {
      fs.rmSync(bad, { recursive: true, force: true });
    }
  });
});

describe("categoryFromPrefix", () => {
  const map = { prefixes: { "arrow_": "navigation", "home": "action", "search": "action", "folder": "file" } };

  test("matches longest prefix", () => {
    expect(categoryFromPrefix("arrow_back", map)).toBe("navigation");
    expect(categoryFromPrefix("arrow_forward_ios", map)).toBe("navigation");
  });

  test("exact-match entries", () => {
    expect(categoryFromPrefix("home", map)).toBe("action");
    expect(categoryFromPrefix("search", map)).toBe("action");
  });

  test("prefix match with longer name", () => {
    expect(categoryFromPrefix("folder_open", map)).toBe("file");
  });

  test("no match returns undefined", () => {
    expect(categoryFromPrefix("zzz_unknown", map)).toBeUndefined();
  });
});

describe("deriveAliases", () => {
  test("splits on underscore and dedupes", () => {
    expect(deriveAliases("home_work_outline")).toEqual(["home", "work", "outline"]);
  });

  test("returns full name when there are no tokens", () => {
    // A single-token name produces a single alias.
    expect(deriveAliases("home")).toEqual(["home"]);
  });
});

describe("deriveTags", () => {
  test("combines category, tokens, and upstream tags", () => {
    const tags = deriveTags("action", "home_work", ["house", "residence"]);
    // Category should appear; tokens should appear; upstream tags should appear; deduped.
    expect(tags).toEqual(expect.arrayContaining(["action", "home", "work", "house", "residence"]));
  });

  test("dedupes overlapping tokens", () => {
    const tags = deriveTags("action", "home", ["home"]);
    const uniq = new Set(tags);
    expect(uniq.size).toBe(tags.length);
  });
});

describe("generated metadata — schema validation", () => {
  // Shape of the Ajv-compiled validator function (minimal, for tests).
  interface CompiledValidator {
    (data: unknown): boolean;
    errors?: unknown;
  }

  // Shared helper so the draft-2020-12 Ajv instance is compiled once.
  async function compileValidator(): Promise<CompiledValidator> {
    const schemaPath = path.resolve("icons/material-symbols/metadata.schema.json");
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    const Ajv2020Module = (await import("ajv/dist/2020.js")) as unknown as { default?: unknown };
    const addFormatsModule = (await import("ajv-formats")) as unknown as { default?: unknown };
    type AjvCtor = new (opts: { allErrors: boolean; strict: boolean }) => {
      compile: (schema: unknown) => CompiledValidator;
    };
    type AddFormatsFn = (ajv: unknown) => void;
    const Ajv2020 = (Ajv2020Module.default ?? Ajv2020Module) as AjvCtor;
    const addFormats = (addFormatsModule.default ?? addFormatsModule) as AddFormatsFn;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv.compile(schema);
  }

  test("a well-formed metadata.json passes the shipped schema", async () => {
    const validate = await compileValidator();
    const metadata = {
      version: "1.0.0",
      source: "google/material-design-icons",
      generated: new Date().toISOString(),
      icons: [
        {
          name: "home",
          category: "action",
          tags: ["action", "home"],
          aliases: ["house"],
          styles: ["outlined", "rounded", "sharp"],
        },
      ],
    };
    const ok = validate(metadata);
    if (!ok) console.error(validate.errors);
    expect(ok).toBe(true);
  });

  test("metadata with empty aliases fails schema (minItems: 1)", async () => {
    const validate = await compileValidator();
    const bad = {
      version: "1.0.0",
      source: "google/material-design-icons",
      generated: new Date().toISOString(),
      icons: [
        {
          name: "home",
          category: "action",
          tags: [],
          aliases: [],
          styles: ["outlined"],
        },
      ],
    };
    expect(validate(bad)).toBe(false);
  });

  test("metadata with invalid style enum fails schema", async () => {
    const validate = await compileValidator();

    const bad = {
      version: "1.0.0",
      source: "google/material-design-icons",
      generated: new Date().toISOString(),
      icons: [
        {
          name: "home",
          category: "action",
          tags: ["action"],
          aliases: ["house"],
          styles: ["filled"],
        },
      ],
    };
    expect(validate(bad)).toBe(false);
  });
});
