/**
 * Structural tests for the SPEC-008 component-browser pages.
 *
 * The project's Jest config uses `testEnvironment: "node"` and does not
 * ship jsdom by default, so we follow the same pattern as
 * `live-preview.test.tsx`: mock out the @/ alias deps and verify
 * module-level exports + shape.
 *
 * End-to-end rendering / CSP violation observation is covered by the
 * Playwright spec `__tests__/e2e/playground-csp.spec.ts` (future SPEC-014
 * QA pass — the srcdoc-builder unit tests already lock the CSP string).
 */

import { describe, it, expect, jest, beforeAll } from "@jest/globals";

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// next/navigation, next/link, next/dynamic, and all the `@/` deps must be
// mocked because jest-environment-node cannot execute the real versions.

beforeAll(() => {
  jest.unstable_mockModule("next/navigation", () => ({
    notFound: () => {
      throw new Error("__not_found__");
    },
    useRouter: () => ({ push: () => {} }),
    usePathname: () => "/components",
  }));

  jest.unstable_mockModule("next/link", () => ({
    default: (props: { href: string; children: unknown }) => props.children,
  }));

  jest.unstable_mockModule("next/dynamic", () => ({
    default: () => function Stub() { return null; },
  }));

  jest.unstable_mockModule("@/components/features/Breadcrumbs", () => ({
    Breadcrumbs: () => null,
  }));

  jest.unstable_mockModule("@/components/features/MonacoEditor", () => ({
    MonacoEditor: () => null,
  }));

  jest.unstable_mockModule("@/components/ui/input", () => ({
    Input: "input",
  }));

  jest.unstable_mockModule("@/components/ui/badge", () => ({
    Badge: "span",
  }));

  jest.unstable_mockModule("@/components/ui/button", () => ({
    Button: "button",
  }));

  jest.unstable_mockModule("@/components/ui/select", () => ({
    Select: ({ children }: { children: unknown }) => children,
    SelectContent: ({ children }: { children: unknown }) => children,
    SelectItem: ({ children }: { children: unknown }) => children,
    SelectTrigger: ({ children }: { children: unknown }) => children,
    SelectValue: () => null,
  }));

  // Stub the API client — the page and viewer both import from @/lib/api.
  jest.unstable_mockModule("@/lib/api", () => ({
    getComponents: jest.fn<() => Promise<{ items: unknown[]; total: number }>>()
      .mockResolvedValue({ items: [], total: 0 }),
    getComponentSpec: jest.fn<(name: string) => Promise<unknown>>(),
    getComponentPreviewUrl: (name: string) =>
      `http://localhost:8096/api/components/${encodeURIComponent(name)}/preview`,
  }));
});

describe("components index page (/components)", () => {
  it("exports a default function component", async () => {
    const mod = await import("../app/(admin)/components/page");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("the default export is the page component", async () => {
    const mod = await import("../app/(admin)/components/page");
    expect(mod.default.name).toBe("ComponentsIndexPage");
  });
});

describe("components detail page (/components/[name])", () => {
  it("exports default async page + generateMetadata", async () => {
    const mod = await import("../app/(admin)/components/[name]/page");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.generateMetadata).toBe("function");
  });

  it("generateMetadata for missing component returns a 'not found' title", async () => {
    const { generateMetadata } = await import(
      "../app/(admin)/components/[name]/page"
    );
    const api = await import("@/lib/api");
    const mockFn = api.getComponentSpec as unknown as jest.Mock<
      (name: string) => Promise<unknown>
    >;
    mockFn.mockRejectedValueOnce(new Error("404 not found"));
    const meta = await generateMetadata({
      params: Promise.resolve({ name: "nope" }),
    });
    expect(meta.title).toContain("not found");
  });

  it("generateMetadata for a real component uses its name + description", async () => {
    const { generateMetadata } = await import(
      "../app/(admin)/components/[name]/page"
    );
    const api = await import("@/lib/api");
    const mockFn = api.getComponentSpec as unknown as jest.Mock<
      (name: string) => Promise<unknown>
    >;
    mockFn.mockResolvedValueOnce({
      name: "Button",
      tier: "ui",
      path: "components/ui/button.tsx",
      client: false,
      description: "Clickable primary action.",
    });
    const meta = await generateMetadata({
      params: Promise.resolve({ name: "Button" }),
    });
    expect(meta.title).toBe("Button — Components");
    expect(meta.description).toBe("Clickable primary action.");
  });
});

describe("ComponentSpecViewer", () => {
  it("exports a named function component", async () => {
    const mod = await import(
      "../components/features/ComponentSpecViewer/ComponentSpecViewer"
    );
    expect(mod.ComponentSpecViewer).toBeDefined();
    expect(typeof mod.ComponentSpecViewer).toBe("function");
  });
});

describe("VariantsGallery", () => {
  it("exports a named function component", async () => {
    const mod = await import(
      "../components/features/ComponentSpecViewer/VariantsGallery"
    );
    expect(mod.VariantsGallery).toBeDefined();
    expect(typeof mod.VariantsGallery).toBe("function");
  });
});

describe("Playground", () => {
  it("exports a named function component that uses allow-scripts sandbox", async () => {
    const mod = await import(
      "../components/features/ComponentSpecViewer/Playground"
    );
    expect(mod.Playground).toBeDefined();
    expect(typeof mod.Playground).toBe("function");

    // Inspect the source for the security-critical sandbox attribute.
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL(
        "../components/features/ComponentSpecViewer/Playground.tsx",
        import.meta.url,
      ),
      "utf-8",
    );
    expect(source).toMatch(/sandbox=["']allow-scripts["']/);
    // Must NOT include allow-same-origin on the playground iframe.
    expect(source).not.toMatch(/sandbox=["']allow-scripts allow-same-origin["']/);
  });
});
