/**
 * Unit tests for template parser — extracts @meta YAML from JSDoc blocks.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseTemplate } from "../src/api/lib/parser";

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-parser-test-"));

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeTmp(filename: string, content: string): string {
  const filePath = path.join(TMP_DIR, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("parseTemplate", () => {
  test("parses valid @meta block with all fields", () => {
    const file = writeTmp("valid.tsx", `/**
 * @meta
 * category: dashboards
 * name: analytics-dashboard
 * description: Analytics dashboard with chart widgets
 * tags: [dashboard, charts, analytics]
 * source: generated
 */
export default function AnalyticsDashboard() { return null; }
`);

    const result = parseTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.meta.category).toBe("dashboards");
    expect(result!.meta.name).toBe("analytics-dashboard");
    expect(result!.meta.description).toBe("Analytics dashboard with chart widgets");
    expect(result!.meta.tags).toEqual(["dashboard", "charts", "analytics"]);
    expect(result!.meta.source).toBe("generated");
    expect(result!.sourceCode).toContain("AnalyticsDashboard");
    expect(result!.filePath).toBe(path.resolve(file));
  });

  test("returns null for file without @meta block", () => {
    const file = writeTmp("no-meta.tsx", `export default function Foo() { return null; }`);
    expect(parseTemplate(file)).toBeNull();
  });

  test("returns null for missing category", () => {
    const file = writeTmp("no-cat.tsx", `/**
 * @meta
 * name: test
 */
export default function Test() { return null; }
`);
    expect(parseTemplate(file)).toBeNull();
  });

  test("returns null for missing name", () => {
    const file = writeTmp("no-name.tsx", `/**
 * @meta
 * category: test
 */
export default function Test() { return null; }
`);
    expect(parseTemplate(file)).toBeNull();
  });

  test("returns null for nonexistent file", () => {
    expect(parseTemplate("/nonexistent/file.tsx")).toBeNull();
  });

  test("handles empty tags array", () => {
    const file = writeTmp("empty-tags.tsx", `/**
 * @meta
 * category: test
 * name: empty-tags
 * tags: []
 */
export default function EmptyTags() { return null; }
`);

    const result = parseTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.meta.tags).toEqual([]);
  });

  test("handles missing optional fields with defaults", () => {
    const file = writeTmp("minimal.tsx", `/**
 * @meta
 * category: test
 * name: minimal
 */
export default function Minimal() { return null; }
`);

    const result = parseTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.meta.description).toBe("");
    expect(result!.meta.tags).toEqual([]);
    expect(result!.meta.source).toBe("unknown");
  });

  test("handles single-item tags array", () => {
    const file = writeTmp("single-tag.tsx", `/**
 * @meta
 * category: test
 * name: single-tag
 * tags: [only-one]
 */
export default function SingleTag() { return null; }
`);

    const result = parseTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.meta.tags).toEqual(["only-one"]);
  });
});
