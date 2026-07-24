/**
 * @jest-environment jsdom
 *
 * SPEC-009 page + helpers:
 *   - icon-utils: inline JSX snippet builder, match helper (pure)
 *   - IconsPage: initial render, filtering, virtualization behaviour,
 *     and detail sheet copy/download wiring
 *
 * Testing notes:
 *   - @testing-library/react registers its own afterEach hook at import
 *     time, so it must be imported at module top level (not inside
 *     individual tests) or Jest rejects it under ESM.
 *   - The Express `/api/icons` client (`@/lib/api`) is mocked with
 *     jest.unstable_mockModule BEFORE the page module is imported so the
 *     page's static `import` resolves against the mock.
 *   - Clipboard / URL.createObjectURL / ResizeObserver are stubbed to
 *     avoid NotImplementedError in jsdom.
 *   - Layout is forced via prototype getters + getBoundingClientRect
 *     stubs so @tanstack/react-virtual returns visible rows.
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import * as React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// -------- pure helper tests -------------------------------------------------

describe("icon-utils", () => {
  it("matchIcon matches on name, alias, and tag (case-insensitive)", async () => {
    const { matchIcon } = await import(
      "../app/(admin)/icons/icon-utils"
    );
    const icon = {
      name: "home_filled",
      aliases: ["house"],
      tags: ["Residence", "building"],
    };
    expect(matchIcon(icon, "")).toBe(true);
    expect(matchIcon(icon, "home")).toBe(true);
    expect(matchIcon(icon, "HOME")).toBe(true);
    expect(matchIcon(icon, "hous")).toBe(true);
    expect(matchIcon(icon, "resi")).toBe(true);
    expect(matchIcon(icon, "nomatch")).toBe(false);
  });

  it("buildInlineJsxSnippet strips prolog/comments and converts hyphenated attrs", async () => {
    const { buildInlineJsxSnippet } = await import(
      "../app/(admin)/icons/icon-utils"
    );
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<!-- comment -->` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"` +
      ` stroke-width="2" class="foo"><path d="M0 0"/></svg>`;
    const out = buildInlineJsxSnippet(svg, "home");
    expect(out.startsWith("// home\n")).toBe(true);
    expect(out).not.toContain("<?xml");
    expect(out).not.toContain("<!--");
    expect(out).toContain('strokeWidth="2"');
    expect(out).toContain('className="icon"');
    expect(out).not.toContain("MaterialSymbol");
  });

  it("buildInlineJsxSnippet adds className when none is present", async () => {
    const { buildInlineJsxSnippet } = await import(
      "../app/(admin)/icons/icon-utils"
    );
    const svg = `<svg viewBox="0 0 24 24"><path d="M1 2"/></svg>`;
    const out = buildInlineJsxSnippet(svg, "a", "mySvg");
    expect(out).toContain('className="mySvg"');
  });

  it("copyTextToClipboard prefers navigator.clipboard", async () => {
    const { copyTextToClipboard } = await import(
      "../app/(admin)/icons/icon-utils"
    );
    const writeText = jest.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const ok = await copyTextToClipboard("hello");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });
});

// -------- page + grid tests -------------------------------------------------

const mockIcons = [
  {
    name: "home",
    category: "home",
    tags: ["house"],
    aliases: ["house"],
    styles: ["outlined", "rounded", "sharp"],
  },
  {
    name: "settings",
    category: "action",
    tags: ["gear"],
    aliases: [],
    styles: ["outlined", "rounded"],
  },
  {
    name: "delete",
    category: "action",
    tags: ["trash", "bin"],
    aliases: ["remove"],
    styles: ["outlined"],
  },
];

// ---- one-time global polyfills that must be in place before any module
// under test is imported. These touch prototypes, not singletons, so
// they're safe to set once for the whole file.

if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
}

if (!("createObjectURL" in URL)) {
  (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = () =>
    "blob:mock";
}
if (!("revokeObjectURL" in URL)) {
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

// Force deterministic layout on the DOM elements the virtualizer
// measures. 800x600 is wide enough to render at least one row of cells.
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 800;
  },
});
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return 600;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return 800;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return 600;
  },
});
HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
};

// Stub out Breadcrumbs globally — it imports next/navigation which jsdom
// can't provide without additional wiring. A noop component is enough.
jest.unstable_mockModule("@/components/features/Breadcrumbs", () => ({
  __esModule: true,
  Breadcrumbs: () => null,
}));

// Mock the API client globally. Each test can swap the implementations
// via the exported references (they're jest.fn()s, so we can re-mock
// return values with .mockImplementationOnce / .mockResolvedValue).
type GetIconsRet = {
  items: typeof mockIcons;
  total: number;
  page: number;
  limit: number;
};
const apiMock = {
  getIcons: jest.fn<(opts?: unknown) => Promise<GetIconsRet>>(async () => ({
    items: mockIcons,
    total: mockIcons.length,
    page: 1,
    limit: 0,
  })),
  getIconCategories: jest.fn(async () => [
    { category: "action", count: 2 },
    { category: "home", count: 1 },
  ]),
  getIcon: jest.fn(async (name: string) => {
    const icon = mockIcons.find((i) => i.name === name);
    if (!icon) throw new Error("not found");
    return { ...icon, availableStyles: icon.styles };
  }),
  getIconSvg: jest.fn(
    async (name: string, style: string) =>
      `<svg data-name="${name}" data-style="${style}" viewBox="0 0 24 24"><path d="M0 0"/></svg>`,
  ),
  getIconSvgUrl: jest.fn(
    (name: string, style: string) =>
      `http://localhost:8096/api/icons/${name}/svg?style=${style}`,
  ),
};

jest.unstable_mockModule("@/lib/api", () => ({
  __esModule: true,
  ...apiMock,
}));

// Import the page AFTER mocks are registered so the page's static imports
// resolve against the mocked module.
const pageModulePromise = import("../app/(admin)/icons/page");

beforeEach(() => {
  for (const key of Object.keys(apiMock) as Array<keyof typeof apiMock>) {
    (apiMock[key] as unknown as { mockClear: () => void }).mockClear();
  }
});

afterEach(() => {
  cleanup();
});

describe("IconsPage", () => {
  it("renders the grid and total count after loading", async () => {
    const { default: IconsPage } = await pageModulePromise;
    render(React.createElement(IconsPage));

    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain("3"),
    );
    expect(screen.getByTestId("icon-cell-home")).toBeTruthy();
    expect(screen.getByTestId("icon-cell-settings")).toBeTruthy();
    expect(screen.getByTestId("icon-cell-delete")).toBeTruthy();
  });

  it("virtualization renders only a windowed subset of a large dataset", async () => {
    // Build a large synthetic dataset. The 800x600 viewport + 116px row
    // height + overscan (6) can accommodate at most ~70 virtualized rows.
    // We assert rendered cell count stays far below total icon count.
    const BIG = 2000;
    const big = Array.from({ length: BIG }, (_, i) => ({
      name: `icon_${i}`,
      category: i % 2 === 0 ? "action" : "home",
      tags: [`tag_${i}`],
      aliases: [`alias_${i}`],
      styles: ["outlined", "rounded", "sharp"],
    }));
    const origImpl = apiMock.getIcons.getMockImplementation();
    apiMock.getIcons.mockImplementation(async () => ({
      items: big,
      total: big.length,
      page: 1,
      limit: 0,
    }));

    try {
      const { default: IconsPage } = await pageModulePromise;
      render(React.createElement(IconsPage));

      await waitFor(() =>
        // Badge uses toLocaleString() → "2,000 of 2,000" — strip commas
        // before asserting to keep the test locale-agnostic.
        expect(
          screen.getByTestId("icons-total").textContent?.replace(/,/g, ""),
        ).toContain(String(BIG)),
      );

      const scroll = screen.getByTestId("icon-grid-scroll");
      const rendered = scroll.querySelectorAll(
        '[data-testid^="icon-cell-"]',
      ).length;
      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(BIG / 2);
    } finally {
      if (origImpl) apiMock.getIcons.mockImplementation(origImpl);
    }
  });

  it("filters icons by style chip selection", async () => {
    const { default: IconsPage } = await pageModulePromise;
    render(React.createElement(IconsPage));

    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain("3"),
    );

    fireEvent.click(screen.getByTestId("style-sharp"));
    // Only `home` declares the sharp style.
    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain(
        "1 of 3",
      ),
    );
    expect(screen.getByTestId("icon-cell-home")).toBeTruthy();
    expect(screen.queryByTestId("icon-cell-settings")).toBeNull();
    expect(screen.queryByTestId("icon-cell-delete")).toBeNull();
  });

  it("filters by search term (alias)", async () => {
    const { default: IconsPage } = await pageModulePromise;
    render(React.createElement(IconsPage));

    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain("3"),
    );

    fireEvent.change(screen.getByTestId("icons-search"), {
      target: { value: "house" }, // alias for "home"
    });

    await waitFor(
      () =>
        expect(screen.getByTestId("icons-total").textContent).toContain(
          "1 of 3",
        ),
      { timeout: 2000 },
    );
    expect(screen.getByTestId("icon-cell-home")).toBeTruthy();
  });

  it("opens the detail sheet and copies SVG to clipboard", async () => {
    const writeText = jest.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { default: IconsPage } = await pageModulePromise;
    render(React.createElement(IconsPage));

    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain("3"),
    );
    fireEvent.click(screen.getByTestId("icon-cell-home"));

    await waitFor(() =>
      expect(screen.getByTestId("icon-detail-sheet")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("copy-svg-outlined"));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copiedText = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copiedText).toContain("<svg");
    expect(copiedText).toContain('data-name="home"');
    expect(copiedText).not.toContain("MaterialSymbol");
  });

  it("copy React JSX emits inline SVG without MaterialSymbol wrapper", async () => {
    const writeText = jest.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { default: IconsPage } = await pageModulePromise;
    render(React.createElement(IconsPage));

    await waitFor(() =>
      expect(screen.getByTestId("icons-total").textContent).toContain("3"),
    );
    fireEvent.click(screen.getByTestId("icon-cell-settings"));
    await waitFor(() =>
      expect(screen.getByTestId("icon-detail-sheet")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("copy-jsx-outlined"));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).toMatch(/<svg[^>]*className=/);
    expect(copied).not.toContain("MaterialSymbol");
    expect(copied).not.toContain("import ");
  });
});
