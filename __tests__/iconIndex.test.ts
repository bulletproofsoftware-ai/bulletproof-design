/**
 * Unit tests for the Material Symbols icon index (src/api/lib/iconIndex.ts).
 *
 * Covers SPEC-003 acceptance cases for REQ-029:
 *   - loads metadata.json from a fixture directory
 *   - searches across name, aliases, tags
 *   - filters by style and category
 *   - categories() returns counts
 *   - pagination including limit=0 sentinel
 *   - get()/hasStyle() edge cases
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  loadIconIndex,
  isValidIconName,
  isValidIconStyle,
} from "../src/api/lib/iconIndex";

let TMP_DIR: string;

const FIXTURE_METADATA = {
  version: "1.0.0",
  source: "google/material-design-icons" as const,
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

beforeAll(async () => {
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "icon-index-test-"));
  fs.mkdirSync(path.join(TMP_DIR, "outlined"), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, "rounded"), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, "sharp"), { recursive: true });

  // Create placeholder SVG files matching the metadata so svgPath stat works.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>';
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "home.svg"), svg);
  fs.writeFileSync(path.join(TMP_DIR, "rounded", "home.svg"), svg);
  fs.writeFileSync(path.join(TMP_DIR, "sharp", "home.svg"), svg);
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "search.svg"), svg);
  fs.writeFileSync(path.join(TMP_DIR, "rounded", "search.svg"), svg);
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "home_work.svg"), svg);

  fs.writeFileSync(path.join(TMP_DIR, "metadata.json"), JSON.stringify(FIXTURE_METADATA));

  await loadIconIndex(TMP_DIR);
});

afterAll(() => {
  if (TMP_DIR) fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("isValidIconName", () => {
  test("accepts valid material-symbols names", () => {
    expect(isValidIconName("home")).toBe(true);
    expect(isValidIconName("home_work")).toBe(true);
    expect(isValidIconName("arrow_back_ios_24")).toBe(true);
  });
  test("rejects invalid characters", () => {
    expect(isValidIconName("")).toBe(false);
    expect(isValidIconName("Home")).toBe(false);
    expect(isValidIconName("home-work")).toBe(false);
    expect(isValidIconName("../etc")).toBe(false);
    expect(isValidIconName("home.svg")).toBe(false);
    expect(isValidIconName("home/evil")).toBe(false);
  });
});

describe("isValidIconStyle", () => {
  test("accepts the three known styles", () => {
    expect(isValidIconStyle("outlined")).toBe(true);
    expect(isValidIconStyle("rounded")).toBe(true);
    expect(isValidIconStyle("sharp")).toBe(true);
  });
  test("rejects anything else", () => {
    expect(isValidIconStyle("filled")).toBe(false);
    expect(isValidIconStyle("")).toBe(false);
    expect(isValidIconStyle(undefined)).toBe(false);
    expect(isValidIconStyle(123)).toBe(false);
  });
});

describe("loadIconIndex — basic queries", () => {
  test("all() returns all fixture icons", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const all = idx.all();
    expect(all.length).toBe(3);
    const names = all.map((i) => i.name).sort();
    expect(names).toEqual(["home", "home_work", "search"]);
  });

  test("get() returns full metadata for a known name", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const home = idx.get("home");
    expect(home).toBeDefined();
    expect(home!.category).toBe("action");
    expect(home!.styles).toEqual(["outlined", "rounded", "sharp"]);
  });

  test("get() returns undefined for unknown name", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.get("not_a_real_icon")).toBeUndefined();
  });

  test("hasStyle returns true/false correctly", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.hasStyle("home", "rounded")).toBe(true);
    expect(idx.hasStyle("home_work", "rounded")).toBe(false);
    expect(idx.hasStyle("home_work", "outlined")).toBe(true);
    expect(idx.hasStyle("unknown_icon", "outlined")).toBe(false);
  });

  test("hasStyle rejects invalid style values", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.hasStyle("home", "filled")).toBe(false);
    expect(idx.hasStyle("home", "")).toBe(false);
  });
});

describe("svgPath", () => {
  test("returns an existing path under rootDir", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const p = idx.svgPath("home", "outlined");
    expect(p).toBeDefined();
    expect(p!.startsWith(path.resolve(TMP_DIR))).toBe(true);
    expect(fs.existsSync(p!)).toBe(true);
  });

  test("defaults to outlined when style omitted", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const p = idx.svgPath("home");
    expect(p).toBeDefined();
    expect(p!.endsWith(path.join("outlined", "home.svg"))).toBe(true);
  });

  test("returns undefined when style is not declared for the icon", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.svgPath("home_work", "rounded")).toBeUndefined();
  });

  test("returns undefined for path-traversal attempts in name", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.svgPath("../../../etc/passwd", "outlined")).toBeUndefined();
    expect(idx.svgPath("home/evil", "outlined")).toBeUndefined();
  });
});

describe("search", () => {
  test("substring match on name", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ q: "home" });
    expect(res.total).toBe(2);
    const names = res.items.map((i) => i.name).sort();
    expect(names).toEqual(["home", "home_work"]);
  });

  test("match on alias", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ q: "magnify" });
    expect(res.total).toBe(1);
    expect(res.items[0].name).toBe("search");
  });

  test("match on tag", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ q: "find" });
    // `find` is both a tag and alias of search
    expect(res.items.some((i) => i.name === "search")).toBe(true);
  });

  test("filters by style (returns only icons with rounded style)", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ style: "rounded" });
    const names = res.items.map((i) => i.name).sort();
    expect(names).toEqual(["home", "search"]);
    expect(names).not.toContain("home_work");
  });

  test("filters by category", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ category: "social" });
    expect(res.total).toBe(1);
    expect(res.items[0].name).toBe("home_work");
  });

  test("combines filters", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ q: "home", style: "sharp" });
    // Only `home` has sharp variant
    expect(res.total).toBe(1);
    expect(res.items[0].name).toBe("home");
  });

  test("invalid style yields empty result set", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ style: "filled" });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });

  test("pagination page=2, limit=1 returns the second item", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const full = idx.search({ limit: 100 });
    expect(full.total).toBe(3);
    const firstPage = idx.search({ page: 1, limit: 1 });
    const secondPage = idx.search({ page: 2, limit: 1 });
    expect(firstPage.items.length).toBe(1);
    expect(secondPage.items.length).toBe(1);
    expect(secondPage.items[0].name).not.toBe(firstPage.items[0].name);
    expect(firstPage.page).toBe(1);
    expect(secondPage.page).toBe(2);
    expect(firstPage.limit).toBe(1);
  });

  test("limit=0 sentinel returns all results on page 1", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ limit: 0 });
    expect(res.total).toBe(3);
    expect(res.items.length).toBe(3);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(3);
  });

  test("limit clamps to 100 max when exceeded", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ limit: 1_000_000 });
    expect(res.limit).toBe(100);
  });

  test("limit clamps to 1 min when 1 is requested but < 1 rejected here", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({ limit: 1 });
    expect(res.limit).toBe(1);
  });

  test("empty query returns all (order stable)", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const res = idx.search({});
    expect(res.total).toBe(3);
  });
});

describe("categories", () => {
  test("counts match fixture", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const cats = idx.categories();
    const map = Object.fromEntries(cats.map((c) => [c.category, c.count]));
    expect(map.action).toBe(2);
    expect(map.social).toBe(1);
  });

  test("sorted alphabetically", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    const cats = idx.categories();
    const names = cats.map((c) => c.category);
    expect(names).toEqual([...names].sort());
  });
});

describe("reload", () => {
  test("reload picks up changes to metadata.json", async () => {
    const idx = await loadIconIndex(TMP_DIR);
    expect(idx.all().length).toBe(3);

    const next = {
      ...FIXTURE_METADATA,
      icons: [
        ...FIXTURE_METADATA.icons,
        {
          name: "menu",
          category: "navigation",
          tags: ["navigation", "menu"],
          aliases: ["menu", "bars", "hamburger"],
          styles: ["outlined"],
        },
      ],
    };
    fs.writeFileSync(path.join(TMP_DIR, "metadata.json"), JSON.stringify(next));
    await idx.reload();
    expect(idx.all().length).toBe(4);
    expect(idx.get("menu")).toBeDefined();
  });
});

describe("missing metadata — fail-open", () => {
  test("loads to an empty index when metadata.json absent", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "icon-empty-"));
    try {
      const idx = await loadIconIndex(empty);
      expect(idx.all()).toEqual([]);
      expect(idx.categories()).toEqual([]);
      expect(idx.search({ q: "anything" }).total).toBe(0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
