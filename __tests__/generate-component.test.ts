import { describe, it, expect, afterEach } from "@jest/globals";
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";
import {
  classifyTier,
  extractComponentName,
  findSimilarComponents,
  generateComponent,
} from "../scripts/generate-component.js";

/* ───────────── Tier Classification ───────────── */

describe("classifyTier", () => {
  it("classifies template-related descriptions as features", () => {
    expect(classifyTier("template editor toolbar")).toBe("features");
  });

  it("classifies brand-related descriptions as features", () => {
    expect(classifyTier("a brand identity card")).toBe("features");
  });

  it("classifies dashboard descriptions as features", () => {
    expect(classifyTier("dashboard metrics panel")).toBe("features");
  });

  it("classifies sidebar descriptions as features", () => {
    expect(classifyTier("collapsible sidebar navigation")).toBe("features");
  });

  it("classifies aurora descriptions as effects", () => {
    expect(classifyTier("aurora background")).toBe("effects");
  });

  it("classifies animation descriptions as effects", () => {
    expect(classifyTier("loading animation spinner")).toBe("effects");
  });

  it("classifies sparkle descriptions as effects", () => {
    expect(classifyTier("sparkle text effect")).toBe("effects");
  });

  it("classifies parallax descriptions as effects", () => {
    expect(classifyTier("parallax scrolling hero")).toBe("effects");
  });

  it("classifies generic UI descriptions as primitives", () => {
    expect(classifyTier("search input")).toBe("primitives");
  });

  it("classifies card descriptions without product terms as primitives", () => {
    expect(classifyTier("a notification badge with count")).toBe("primitives");
  });
});

/* ───────────── Name Extraction ───────────── */

describe("extractComponentName", () => {
  it("extracts PascalCase name from description", () => {
    expect(extractComponentName("subscription status card")).toBe(
      "SubscriptionStatusCard",
    );
  });

  it("strips stop words", () => {
    expect(extractComponentName("a card that shows status")).toBe(
      "CardStatus",
    );
  });

  it("handles complex descriptions", () => {
    const name = extractComponentName(
      "a notification badge with count",
    );
    expect(name).toBe("NotificationBadgeCount");
  });

  it("handles empty-ish descriptions", () => {
    expect(extractComponentName("a the an")).toBe("GeneratedComponent");
  });

  it("limits to 4 words", () => {
    const name = extractComponentName(
      "very long component name description extra words",
    );
    expect(name).toBe("VeryLongComponentName");
  });
});

/* ───────────── Fuzzy Matching ───────────── */

describe("findSimilarComponents", () => {
  const tmpDir = resolve(tmpdir(), "gen-test-registry-" + Date.now());
  const registryPath = resolve(tmpDir, "registry.json");

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("finds similar components by substring", () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      registryPath,
      JSON.stringify({
        components: [
          { name: "Badge" },
          { name: "Button" },
          { name: "NotificationBadge" },
        ],
      }),
    );

    const similar = findSimilarComponents("Badge", registryPath);
    expect(similar).toContain("Badge");
    expect(similar).toContain("NotificationBadge");
    expect(similar).not.toContain("Button");
  });

  it("returns empty array when registry does not exist", () => {
    expect(findSimilarComponents("Foo", "/nonexistent/path.json")).toEqual([]);
  });
});

/* ───────────── File Generation ───────────── */

describe("generateComponent", () => {
  const tmpBase = resolve(tmpdir(), "gen-test-" + Date.now());
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      if (existsSync(d)) {
        rmSync(d, { recursive: true, force: true });
      }
    }
    dirs.length = 0;
  });

  function makeTmpRoot(): string {
    const dir = resolve(tmpBase, String(Date.now()) + Math.random().toString(36).slice(2));
    mkdirSync(resolve(dir, "components"), { recursive: true });
    mkdirSync(resolve(dir, "src", "components"), { recursive: true });
    mkdirSync(resolve(dir, "src", "styles"), { recursive: true });
    dirs.push(dir);
    return dir;
  }

  it("creates expected files for a primitives component", async () => {
    const root = makeTmpRoot();
    const result = await generateComponent("a notification badge with count", {
      rootDir: root,
    });

    expect(result.tier).toBe("primitives");
    expect(result.name).toBe("NotificationBadgeCount");
    expect(result.files.length).toBe(3);

    for (const f of result.files) {
      expect(existsSync(f)).toBe(true);
    }

    // Check index.ts content
    const indexContent = readFileSync(
      resolve(result.directory, "index.ts"),
      "utf-8",
    );
    expect(indexContent).toContain("export { NotificationBadgeCount }");

    // Check component file content
    const compContent = readFileSync(
      resolve(result.directory, "NotificationBadgeCount.tsx"),
      "utf-8",
    );
    expect(compContent).toContain("NotificationBadgeCount");
    expect(compContent).toContain("cn(");
    expect(compContent).toContain("notification badge with count");

    // Check test file
    const testContent = readFileSync(
      resolve(result.directory, "NotificationBadgeCount.test.tsx"),
      "utf-8",
    );
    expect(testContent).toContain("renders without crashing");
    expect(testContent).toContain("accessibility violations");
  });

  it("creates effects component with use client directive", async () => {
    const root = makeTmpRoot();
    const result = await generateComponent("aurora background effect", {
      rootDir: root,
    });

    expect(result.tier).toBe("effects");

    const compContent = readFileSync(
      join(result.directory, `${result.name}.tsx`),
      "utf-8",
    );
    expect(compContent).toContain('"use client"');
  });

  it("creates features component for product terms", async () => {
    const root = makeTmpRoot();
    const result = await generateComponent("template editor toolbar", {
      rootDir: root,
    });

    expect(result.tier).toBe("features");
  });

  it("warns about similar existing components", async () => {
    const root = makeTmpRoot();

    // Create a mock registry with a Badge component
    writeFileSync(
      resolve(root, "src", "components", "registry.json"),
      JSON.stringify({
        components: [{ name: "Badge", tier: "ui", description: "A badge" }],
      }),
    );

    const result = await generateComponent("notification badge count", {
      rootDir: root,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Badge");
  });

  it("does not include use client for non-interactive primitives", async () => {
    const root = makeTmpRoot();
    const result = await generateComponent("status display panel", {
      rootDir: root,
    });

    const compContent = readFileSync(
      join(result.directory, `${result.name}.tsx`),
      "utf-8",
    );
    expect(compContent).not.toContain('"use client"');
  });
});
