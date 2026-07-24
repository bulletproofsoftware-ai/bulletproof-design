/**
 * @jest-environment jsdom
 *
 * SPEC-011 REQ-061 — Sidebar navigation update.
 *
 * Covers:
 *   - /components and /icons links render
 *   - Dynamic per-brand portal entries render under Brands
 *   - Active-state highlights the route that matches pathname
 *   - /components does NOT highlight on /components-library
 *     (the legacy redirect route that coexists with the new /components)
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
import { render, cleanup, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// next/navigation, next/link, and the @/ deps must be mocked so the Sidebar
// can execute under jsdom without the full Next runtime. usePathname is
// swapped between tests by re-importing the module with a fresh mock.

let mockPathname = "/";

jest.unstable_mockModule("next/navigation", () => ({
  __esModule: true,
  usePathname: () => mockPathname,
}));

jest.unstable_mockModule("next/link", () => ({
  __esModule: true,
  default: (props: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "data-active"?: string;
    "data-external"?: string;
  }) =>
    React.createElement(
      "a",
      {
        href: props.href,
        className: props.className,
        "data-active": props["data-active"],
        "data-external": props["data-external"],
      },
      props.children,
    ),
}));

jest.unstable_mockModule("@/components/ui/scroll-area", () => ({
  __esModule: true,
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

jest.unstable_mockModule("@/components/ui/input", () => ({
  __esModule: true,
  Input: (props: Record<string, unknown>) =>
    React.createElement("input", props),
}));

jest.unstable_mockModule("@/components/ui/badge", () => ({
  __esModule: true,
  Badge: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
}));

type BrandSummary = { name: string; slug: string; description: string };
type Category = { name: string; count: number };

const apiMock = {
  getCategories: jest.fn<() => Promise<Category[]>>(async () => [
    { name: "landing", count: 3 },
    { name: "components", count: 5 },
  ]),
  getBrands: jest.fn<() => Promise<BrandSummary[]>>(async () => [
    { name: "Default", slug: "default", description: "Default brand" },
    { name: "Warm Creative", slug: "warm-creative", description: "Warm" },
  ]),
};

jest.unstable_mockModule("@/lib/api", () => ({
  __esModule: true,
  ...apiMock,
}));

// Dynamic import AFTER mocks are registered.
const sidebarModulePromise = import(
  "../components/features/Sidebar/Sidebar"
);

beforeEach(() => {
  apiMock.getCategories.mockClear();
  apiMock.getBrands.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Sidebar — SPEC-011 REQ-061", () => {
  it("renders the /components link", async () => {
    mockPathname = "/";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/components"]');
      expect(link).toBeTruthy();
    });
  });

  it("renders the /icons link", async () => {
    mockPathname = "/";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/icons"]');
      expect(link).toBeTruthy();
    });
  });

  it("renders a portal entry per brand", async () => {
    mockPathname = "/";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      expect(
        document.querySelector('a[href="/portal/default"]'),
      ).toBeTruthy();
      expect(
        document.querySelector('a[href="/portal/warm-creative"]'),
      ).toBeTruthy();
    });

    // Portal entries must be flagged as external.
    const portalLink = document.querySelector(
      'a[href="/portal/default"]',
    );
    expect(portalLink?.getAttribute("data-external")).toBe("true");
  });

  it("marks /components active when pathname is /components", async () => {
    mockPathname = "/components";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/components"]');
      expect(link?.getAttribute("data-active")).toBe("true");
    });
  });

  it("marks /components active when pathname is /components/Button (nested child)", async () => {
    mockPathname = "/components/Button";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/components"]');
      expect(link?.getAttribute("data-active")).toBe("true");
    });
  });

  it("does NOT mark /components active on /components-library (sibling prefix)", async () => {
    mockPathname = "/components-library";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      // Wait for render by anchoring on a known link.
      expect(document.querySelector('a[href="/components"]')).toBeTruthy();
    });

    const link = document.querySelector('a[href="/components"]');
    expect(link?.getAttribute("data-active")).toBe("false");
  });

  it("marks /icons active on /icons but not on /icons-legacy", async () => {
    mockPathname = "/icons";
    const { Sidebar } = await sidebarModulePromise;
    const { rerender } = render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/icons"]');
      expect(link?.getAttribute("data-active")).toBe("true");
    });

    mockPathname = "/icons-legacy";
    rerender(React.createElement(Sidebar));
    await waitFor(() => {
      const link = document.querySelector('a[href="/icons"]');
      expect(link?.getAttribute("data-active")).toBe("false");
    });
  });

  it("marks portal entry active on /portal/<slug>/<subpath>", async () => {
    mockPathname = "/portal/default/colors";
    const { Sidebar } = await sidebarModulePromise;
    render(React.createElement(Sidebar));

    await waitFor(() => {
      const link = document.querySelector('a[href="/portal/default"]');
      expect(link?.getAttribute("data-active")).toBe("true");
    });
  });
});
