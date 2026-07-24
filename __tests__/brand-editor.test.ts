/**
 * Module-level smoke tests for the SPEC-007 brand admin editor.
 *
 * The project's Jest config uses `testEnvironment: "node"` and doesn't
 * include jsdom or @testing-library/react, so these tests mirror the
 * pattern in portal.spec.ts / live-preview.test.tsx — they verify exports
 * exist and have the expected shape. A lightweight API-helper test block
 * runs against a stubbed `fetch` to confirm URL + header shape for the
 * four new helpers (validateLogoFile, getGuidelinesRaw, putGuidelines,
 * uploadLogo, deleteLogo).
 *
 * Deep UI interaction testing happens in the Playwright spec.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// ───────────────────────────────────────────────────────────────────
// Mock the @/ alias imports used by the tab components. None of these
// modules are exercised — we just need them to resolve so the tab's
// own module loads.
// ───────────────────────────────────────────────────────────────────

jest.unstable_mockModule("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));
jest.unstable_mockModule("@/components/ui/input", () => ({ Input: "input" }));
jest.unstable_mockModule("@/components/ui/button", () => ({ Button: "button" }));
jest.unstable_mockModule("@/components/ui/card", () => ({ Card: "card" }));
jest.unstable_mockModule("@/components/ui/badge", () => ({ Badge: "badge" }));
jest.unstable_mockModule("@/components/ui/tabs", () => ({
  Tabs: "tabs",
  TabsList: "tabs-list",
  TabsTrigger: "tabs-trigger",
  TabsContent: "tabs-content",
}));
jest.unstable_mockModule("@/components/primitives/ColorPicker", () => ({
  ColorPicker: "color-picker",
}));
jest.unstable_mockModule("@/components/primitives/FontPicker", () => ({
  FontPicker: "font-picker",
}));
jest.unstable_mockModule("@/components/primitives/TagInput", () => ({
  TagInput: "tag-input",
}));
jest.unstable_mockModule("@/components/features/Breadcrumbs", () => ({
  Breadcrumbs: "breadcrumbs",
}));
jest.unstable_mockModule("@/components/features/MonacoEditor", () => ({
  MonacoEditor: "monaco-editor",
}));

// ───────────────────────────────────────────────────────────────────
// Module smoke tests
// ───────────────────────────────────────────────────────────────────

describe("BrandEditor module", () => {
  it("exports a named BrandEditor function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/BrandEditor"
    );
    expect(mod.BrandEditor).toBeDefined();
    expect(typeof mod.BrandEditor).toBe("function");
    expect(mod.BrandEditor.name).toBe("BrandEditor");
  });
});

describe("OverviewTab module", () => {
  it("exports a named OverviewTab function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/_tabs/OverviewTab"
    );
    expect(mod.OverviewTab).toBeDefined();
    expect(typeof mod.OverviewTab).toBe("function");
  });
});

describe("ColorsTab module", () => {
  it("exports a named ColorsTab function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/_tabs/ColorsTab"
    );
    expect(mod.ColorsTab).toBeDefined();
    expect(typeof mod.ColorsTab).toBe("function");
  });
});

describe("TypographyTab module", () => {
  it("exports a named TypographyTab function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/_tabs/TypographyTab"
    );
    expect(mod.TypographyTab).toBeDefined();
    expect(typeof mod.TypographyTab).toBe("function");
  });
});

describe("LogosTab module", () => {
  it("exports a named LogosTab function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/_tabs/LogosTab"
    );
    expect(mod.LogosTab).toBeDefined();
    expect(typeof mod.LogosTab).toBe("function");
  });
});

describe("GuidelinesTab module", () => {
  it("exports a named GuidelinesTab function", async () => {
    const mod = await import(
      "../app/(admin)/brands/[slug]/_tabs/GuidelinesTab"
    );
    expect(mod.GuidelinesTab).toBeDefined();
    expect(typeof mod.GuidelinesTab).toBe("function");
  });
});

// ───────────────────────────────────────────────────────────────────
// API helper behaviour — guards the client surface that SPEC-010 will
// formalise. We stub global `fetch` so the tests run offline.
// ───────────────────────────────────────────────────────────────────

describe("SPEC-007 api helpers", () => {
  type FetchStub = jest.Mock<typeof fetch>;
  let fetchMock: FetchStub;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = jest.fn() as unknown as FetchStub;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("validateLogoFile", () => {
    it("rejects files larger than 5 MB", async () => {
      const { validateLogoFile, LOGO_UPLOAD_MAX_BYTES } = await import(
        "../lib/api"
      );
      const big = new File(
        [new Uint8Array(LOGO_UPLOAD_MAX_BYTES + 1)],
        "big.png",
        { type: "image/png" },
      );
      const res = validateLogoFile(big);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/too large/i);
    });

    it("rejects unsupported MIME types", async () => {
      const { validateLogoFile } = await import("../lib/api");
      const gif = new File([new Uint8Array(10)], "pic.gif", {
        type: "image/gif",
      });
      const res = validateLogoFile(gif);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/unsupported/i);
    });

    it("accepts SVG with empty MIME when extension is .svg", async () => {
      const { validateLogoFile } = await import("../lib/api");
      // Some browsers report file.type === '' for SVG — validate falls
      // back to the file extension.
      const svg = new File(["<svg/>"], "logo.svg", { type: "" });
      expect(validateLogoFile(svg).ok).toBe(true);
    });

    it("accepts PNG under 5 MB", async () => {
      const { validateLogoFile } = await import("../lib/api");
      const png = new File([new Uint8Array(1024)], "ok.png", {
        type: "image/png",
      });
      expect(validateLogoFile(png).ok).toBe(true);
    });
  });

  describe("getGuidelinesRaw", () => {
    it("returns empty string on 404", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 404 }) as never,
      );
      const { getGuidelinesRaw } = await import("../lib/api");
      await expect(getGuidelinesRaw("my-brand")).resolves.toBe("");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/brands/my-brand/guidelines?raw=1");
    });

    it("returns raw body on 200", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response("# Hello\n\nBody", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        }) as never,
      );
      const { getGuidelinesRaw } = await import("../lib/api");
      await expect(getGuidelinesRaw("my-brand")).resolves.toBe(
        "# Hello\n\nBody",
      );
    });

    it("throws on 500", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "oops" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }) as never,
      );
      const { getGuidelinesRaw } = await import("../lib/api");
      await expect(getGuidelinesRaw("my-brand")).rejects.toThrow(/oops/);
    });
  });

  describe("putGuidelines", () => {
    it("refuses to send without an API key", async () => {
      const { putGuidelines } = await import("../lib/api");
      await expect(putGuidelines("b", "# md", "")).rejects.toThrow(
        /api key/i,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends text/markdown and the x-api-key header", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, slug: "b", bytes: 4 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }) as never,
      );
      const { putGuidelines } = await import("../lib/api");
      await putGuidelines("b", "# md", "secret");
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("text/markdown");
      expect(headers["x-api-key"]).toBe("secret");
      expect(init.method).toBe("PUT");
      expect(init.body).toBe("# md");
    });
  });

  describe("uploadLogo", () => {
    it("refuses to upload without an API key", async () => {
      const { uploadLogo } = await import("../lib/api");
      const file = new File(["<svg/>"], "l.svg", { type: "image/svg+xml" });
      await expect(
        uploadLogo(
          "b",
          file,
          { key: "icon", label: "x", usage: "y" },
          "",
        ),
      ).rejects.toThrow(/api key/i);
    });

    it("rejects invalid files before hitting the network", async () => {
      const { uploadLogo } = await import("../lib/api");
      const bad = new File(["hi"], "bad.gif", { type: "image/gif" });
      await expect(
        uploadLogo(
          "b",
          bad,
          { key: "icon", label: "x", usage: "y" },
          "secret",
        ),
      ).rejects.toThrow(/unsupported/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("POSTs multipart form data with meta fields", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            slug: "b",
            key: "icon",
            file: "icon-abc.svg",
            url: "http://localhost/…",
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ) as never,
      );
      const { uploadLogo } = await import("../lib/api");
      const file = new File(["<svg/>"], "l.svg", { type: "image/svg+xml" });
      await uploadLogo(
        "b",
        file,
        { key: "icon", label: "Label", usage: "Everywhere", preferred: true },
        "secret",
      );
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/brands/b/logos");
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("secret");
      // Body is a FormData — we can't introspect it in every runtime, but
      // ensure it isn't a string (which would mean we sent JSON by mistake).
      expect(typeof init.body).not.toBe("string");
    });
  });

  describe("deleteLogo", () => {
    it("refuses without an API key", async () => {
      const { deleteLogo } = await import("../lib/api");
      await expect(deleteLogo("b", "icon", "")).rejects.toThrow(/api key/i);
    });

    it("treats 404 as idempotent success", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 404 }) as never,
      );
      const { deleteLogo } = await import("../lib/api");
      await expect(deleteLogo("b", "icon", "secret")).resolves.toEqual({
        ok: true,
      });
    });

    it("sends DELETE with the key in the path", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }) as never,
      );
      const { deleteLogo } = await import("../lib/api");
      await deleteLogo("b", "horizontal", "secret");
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/brands/b/logos/horizontal");
      expect(init.method).toBe("DELETE");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Optional E2E tests — only run when BRAND_EDITOR_E2E=1 is set. Requires
// the Next.js dev server on :8095 and the Express API on :8096. Mirrors
// the pattern used in portal.spec.ts.
// ────────────────────────────────────────────────────────────────────────

const brandEditorE2E = process.env.BRAND_EDITOR_E2E === "1";
const describeE2E = brandEditorE2E ? describe : describe.skip;

describeE2E(
  "Brand editor E2E (requires Next.js dev server on :8095)",
  () => {
    const BASE = "http://localhost:8095";

    it("GET /brands/default renders the tabbed editor", async () => {
      const res = await fetch(`${BASE}/brands/default`);
      expect(res.status).toBe(200);
      const html = await res.text();
      // All five tab triggers should appear in the initial HTML — Radix
      // renders them server-side so their labels are present even before
      // JS hydrates.
      expect(html).toMatch(/Overview/);
      expect(html).toMatch(/Colors/);
      expect(html).toMatch(/Typography/);
      expect(html).toMatch(/Logos/);
      expect(html).toMatch(/Guidelines/);
    });

    it("GET /brands/unknown-brand returns 404", async () => {
      const res = await fetch(`${BASE}/brands/xyzzy-no-such-brand`);
      expect(res.status).toBe(404);
    });

    it("admin list page still renders (regression)", async () => {
      const res = await fetch(`${BASE}/brands`);
      expect(res.status).toBe(200);
    });

    it("configurator still renders (regression)", async () => {
      const res = await fetch(`${BASE}/brands/configurator`);
      expect(res.status).toBe(200);
    });
  },
);
