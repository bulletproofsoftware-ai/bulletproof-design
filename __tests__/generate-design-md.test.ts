import { describe, it, expect } from "@jest/globals";
import {
  buildDesignSystem,
  buildDesignMd,
  buildTokensCss,
  buildManifest,
  type BrandConfig,
  type TokenFile,
} from "../scripts/generate-design-md.js";

const BRAND: BrandConfig = {
  name: "Dark Tech",
  slug: "dark-tech",
  description: "Dark-themed tech aesthetic with green accent",
  colors: {
    primary: "#10b981",
    secondary: "#1e293b",
    accent: "#064e3b",
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    border: "#334155",
    error: "#f87171",
    warning: "#fbbf24",
    success: "#34d399",
  },
  fonts: { heading: "JetBrains Mono", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 12, 16, 24, 32, 48, 64] },
  borderRadius: {
    small: "0.375rem",
    medium: "0.5rem",
    large: "0.75rem",
    full: "9999px",
  },
  shadows: {
    small: "0 2px 8px rgba(0,0,0,0.3)",
    medium: "0 4px 16px rgba(0,0,0,0.4)",
    large: "0 20px 40px rgba(0,0,0,0.5)",
  },
};

const TOKENS: TokenFile = {
  motion: {
    fast: { $value: "150ms", $type: "duration" },
    normal: { $value: "300ms", $type: "duration" },
    slow: { $value: "500ms", $type: "duration" },
  },
};

const NINE_SECTIONS = [
  "## 1. Visual Theme & Atmosphere",
  "## 2. Color",
  "## 3. Typography",
  "## 4. Spacing",
  "## 5. Layout & Composition",
  "## 6. Components",
  "## 7. Motion & Interaction",
  "## 8. Voice & Brand",
  "## 9. Anti-patterns",
];

describe("buildDesignMd", () => {
  const md = buildDesignMd(BRAND, TOKENS);

  it("emits the H1 brand name and category header", () => {
    expect(md.startsWith("# Dark Tech")).toBe(true);
    expect(md).toContain("> Category: Design Library");
  });

  it("contains all nine numbered sections in order", () => {
    let cursor = -1;
    for (const heading of NINE_SECTIONS) {
      const idx = md.indexOf(heading);
      expect(idx).toBeGreaterThan(-1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("maps the brand primary into the color section", () => {
    expect(md).toContain("--color-primary: #10b981;");
  });

  it("includes Display / Body / Mono font stacks", () => {
    expect(md).toContain("--font-display: \"JetBrains Mono\"");
    expect(md).toContain("--font-body: \"Inter\"");
    expect(md).toMatch(/- Display: JetBrains Mono/);
    expect(md).toMatch(/- Body: Inter/);
    expect(md).toMatch(/- Mono: JetBrains Mono/);
  });

  it("emits the spacing scale as --space-N vars", () => {
    expect(md).toContain("--space-0: 0px;");
    expect(md).toContain("--space-8: 64px;");
  });

  it("includes focus-visible and reduced-motion guards", () => {
    expect(md).toContain(":focus-visible");
    expect(md).toContain("prefers-reduced-motion: reduce");
  });
});

describe("buildTokensCss", () => {
  const css = buildTokensCss(BRAND, TOKENS);

  it("is a single :root block with brand + motion vars", () => {
    expect(css).toContain(":root {");
    expect(css).toContain("--color-primary: #10b981;");
    expect(css).toContain("--font-mono: \"JetBrains Mono\"");
    expect(css).toContain("--motion-normal: 300ms;");
    expect(css).toContain("--radius-full: 9999px;");
  });

  it("falls back to default motion when tokens lack a motion category", () => {
    const css2 = buildTokensCss(BRAND, {});
    expect(css2).toContain("--motion-fast: 150ms;");
  });
});

describe("buildManifest", () => {
  it("produces valid indexable metadata", () => {
    const m = buildManifest(BRAND) as Record<string, string>;
    expect(m.slug).toBe("dark-tech");
    expect(m.name).toBe("Dark Tech");
    expect(m.category).toBe("Design Library");
    expect((m.files as unknown as Record<string, string>).design).toBe(
      "DESIGN.md",
    );
  });
});

describe("buildDesignSystem", () => {
  it("assembles all three artifacts under the brand slug", () => {
    const bundle = buildDesignSystem(BRAND, TOKENS);
    expect(bundle.slug).toBe("dark-tech");
    expect(bundle.designMd).toContain("## 9. Anti-patterns");
    expect(bundle.tokensCss).toContain(":root {");
    expect(bundle.manifest.slug).toBe("dark-tech");
  });
});
