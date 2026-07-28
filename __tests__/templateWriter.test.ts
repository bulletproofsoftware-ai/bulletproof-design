/**
 * Unit tests for template writer — file write/delete operations.
 * Uses jest.unstable_mockModule to override env vars before module load.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TMP_TEMPLATES = fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-writer-templates-"));
const TMP_SRC = fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-writer-src-"));

fs.mkdirSync(TMP_TEMPLATES, { recursive: true });
fs.mkdirSync(TMP_SRC, { recursive: true });

// Must set env before dynamic import
process.env.TEMPLATES_DIR = TMP_TEMPLATES;
process.env.SRC_DIR = TMP_SRC;

// Dynamic import to pick up env vars
const { writeTemplate, deleteTemplate } = await import("../src/api/lib/templateWriter");

afterAll(() => {
  fs.rmSync(TMP_TEMPLATES, { recursive: true, force: true });
  fs.rmSync(TMP_SRC, { recursive: true, force: true });
});

describe("writeTemplate", () => {
  test("creates template and story files", () => {
    const result = writeTemplate("test-cat", "test-template", "// test source code");

    expect(result.templatePath).toBeTruthy();
    expect(result.storyPath).toBeTruthy();

    expect(fs.existsSync(result.templatePath)).toBe(true);
    expect(fs.readFileSync(result.templatePath, "utf-8")).toBe("// test source code");

    expect(fs.existsSync(result.storyPath)).toBe(true);
    const storyContent = fs.readFileSync(result.storyPath, "utf-8");
    expect(storyContent).toContain("TestTemplate");
  });

  test("creates category directory if it does not exist", () => {
    const catDir = path.join(TMP_TEMPLATES, "new-category");
    expect(fs.existsSync(catDir)).toBe(false);

    writeTemplate("new-category", "new-template", "// new");
    expect(fs.existsSync(catDir)).toBe(true);
  });

  test("overwrites existing template", () => {
    writeTemplate("overwrite-cat", "overwrite-test", "// version 1");
    writeTemplate("overwrite-cat", "overwrite-test", "// version 2");

    const content = fs.readFileSync(
      path.join(TMP_TEMPLATES, "overwrite-cat", "overwrite-test.tsx"),
      "utf-8"
    );
    expect(content).toBe("// version 2");
  });
});

describe("deleteTemplate", () => {
  test("deletes existing template", () => {
    writeTemplate("del-cat", "del-template", "// to delete");
    const result = deleteTemplate("del-cat", "del-template");
    expect(result).toBe(true);
    expect(fs.existsSync(path.join(TMP_TEMPLATES, "del-cat", "del-template.tsx"))).toBe(false);
  });

  test("returns false for nonexistent template", () => {
    const result = deleteTemplate("nonexistent", "nonexistent");
    expect(result).toBe(false);
  });
});

describe("containment: sibling-prefix traversal", () => {
  // A bare startsWith(root) also accepts a sibling whose name merely begins
  // with the root's — path.resolve(TEMPLATES_DIR, "../<basename>-evil") lands
  // outside the root while still satisfying startsWith. resolveWithin compares
  // against `root + path.sep`, so these must throw.
  const sibling = `../${path.basename(TMP_TEMPLATES)}-evil`;

  test("writeTemplate rejects a category escaping to a sibling directory", () => {
    expect(() => writeTemplate(sibling, "pwned", "// evil")).toThrow(/escapes its permitted root/i);
  });

  test("deleteTemplate rejects a category escaping to a sibling directory", () => {
    expect(() => deleteTemplate(sibling, "pwned")).toThrow(/escapes its permitted root/i);
  });

  test("nothing was written outside the templates root", () => {
    expect(fs.existsSync(`${TMP_TEMPLATES}-evil`)).toBe(false);
  });

  test("a normal category still works", () => {
    const r = writeTemplate("legit-cat", "legit-template", "// ok");
    expect(fs.existsSync(r.templatePath)).toBe(true);
    expect(r.templatePath.startsWith(TMP_TEMPLATES + path.sep)).toBe(true);
  });
});
