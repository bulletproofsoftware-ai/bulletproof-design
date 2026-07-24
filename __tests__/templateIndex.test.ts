/**
 * Unit tests for template index — building, querying, searching.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { buildIndex, getTemplates, getCategories, getByCategory, getByName, search } from "../src/api/lib/templateIndex";

const TMP_DIR = path.join(os.tmpdir(), "design-lib-index-test");

function writeTemplate(category: string, name: string, description = "", tags: string[] = []) {
  const dir = path.join(TMP_DIR, category);
  fs.mkdirSync(dir, { recursive: true });
  const tagStr = tags.length ? tags.join(", ") : "";
  fs.writeFileSync(
    path.join(dir, `${name}.tsx`),
    `/**
 * @meta
 * category: ${category}
 * name: ${name}
 * description: ${description}
 * tags: [${tagStr}]
 * source: test
 */
export default function ${name.replace(/-/g, "")}() { return null; }
`,
    "utf-8"
  );
}

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  writeTemplate("dashboards", "analytics-dashboard", "Analytics with charts", ["dashboard", "charts"]);
  writeTemplate("dashboards", "admin-panel", "Admin panel layout", ["admin", "dashboard"]);
  writeTemplate("auth", "login-page", "Login form", ["auth", "form"]);
  writeTemplate("auth", "signup-page", "Signup form", ["auth", "form"]);
  writeTemplate("landing", "hero-section", "Landing hero", ["landing", "hero"]);

  buildIndex(TMP_DIR);
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("buildIndex + getTemplates", () => {
  test("indexes all templates", () => {
    const all = getTemplates();
    expect(all.length).toBe(5);
  });
});

describe("getCategories", () => {
  test("returns categories with counts", () => {
    const cats = getCategories();
    expect(cats.length).toBe(3);

    const dashCat = cats.find(c => c.name === "dashboards");
    expect(dashCat).toBeDefined();
    expect(dashCat!.count).toBe(2);

    const authCat = cats.find(c => c.name === "auth");
    expect(authCat).toBeDefined();
    expect(authCat!.count).toBe(2);

    const landingCat = cats.find(c => c.name === "landing");
    expect(landingCat).toBeDefined();
    expect(landingCat!.count).toBe(1);
  });

  test("returns categories sorted alphabetically", () => {
    const cats = getCategories();
    const names = cats.map(c => c.name);
    expect(names).toEqual([...names].sort());
  });
});

describe("getByCategory", () => {
  test("returns templates for existing category", () => {
    const results = getByCategory("dashboards");
    expect(results.length).toBe(2);
    expect(results.map(r => r.meta.name).sort()).toEqual(["admin-panel", "analytics-dashboard"]);
  });

  test("is case-insensitive", () => {
    const results = getByCategory("DASHBOARDS");
    expect(results.length).toBe(2);
  });

  test("returns empty array for nonexistent category", () => {
    expect(getByCategory("nonexistent").length).toBe(0);
  });
});

describe("getByName", () => {
  test("finds template by category and name", () => {
    const result = getByName("dashboards", "analytics-dashboard");
    expect(result).toBeDefined();
    expect(result!.meta.name).toBe("analytics-dashboard");
    expect(result!.meta.description).toBe("Analytics with charts");
  });

  test("is case-insensitive", () => {
    const result = getByName("DASHBOARDS", "ANALYTICS-DASHBOARD");
    expect(result).toBeDefined();
  });

  test("returns undefined for nonexistent template", () => {
    expect(getByName("dashboards", "nonexistent")).toBeUndefined();
  });

  test("returns undefined for wrong category", () => {
    expect(getByName("auth", "analytics-dashboard")).toBeUndefined();
  });
});

describe("search", () => {
  test("finds templates by name", () => {
    const results = search("analytics");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].meta.name).toBe("analytics-dashboard");
  });

  test("finds templates by description", () => {
    const results = search("charts");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("finds templates by tag", () => {
    const results = search("hero");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].meta.name).toBe("hero-section");
  });

  test("finds templates by category", () => {
    const results = search("auth");
    expect(results.length).toBe(2);
  });

  test("is case-insensitive", () => {
    const results = search("ANALYTICS");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("returns empty for empty query", () => {
    expect(search("").length).toBe(0);
    expect(search("  ").length).toBe(0);
  });

  test("returns empty for no match", () => {
    expect(search("zzzznonexistentzzz").length).toBe(0);
  });
});
