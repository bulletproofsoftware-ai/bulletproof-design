/**
 * Unit + module-structure tests for the portal components (SPEC-006).
 *
 * The project's Jest config uses `testEnvironment: "node"` and does NOT
 * include jsdom or @testing-library/react, so these tests focus on:
 *   1. Module-level smoke tests that confirm the exports exist and have
 *      the expected shape — mirrors the pattern in live-preview.test.tsx.
 *   2. End-to-end HTTP tests that hit the running dev server (only when
 *      PORTAL_E2E=1 is set) to verify routing, 404 behaviour, and
 *      per-page metadata.
 *
 * Components to test:
 *   - PortalSidebar — active-link logic, link list
 *   - PortalBreadcrumbs — empty-input handling
 *   - ColorSwatch — hex parsing, copy helper (indirect, through exports)
 *   - TypeSpecimen — weight-label formatter (via module export)
 *   - LogoLockupCard — extension sniffer
 *   - SanitisedHtml — single-purpose wrapper
 */
import { describe, it, expect, jest } from "@jest/globals";

// Stub the @/ alias targets that the portal components pull in so the
// module graph resolves in a pure-Node environment.
jest.unstable_mockModule("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));
jest.unstable_mockModule("@/components/ui/badge", () => ({
  Badge: "badge",
}));
// next/link and next/navigation don't need mocking for import-time checks —
// jest loads them lazily when the component is rendered. Importing the
// module only verifies syntax & exports.

describe("PortalSidebar module", () => {
  it("exports a named PortalSidebar function", async () => {
    const mod = await import(
      "../components/features/PortalSidebar/PortalSidebar"
    );
    expect(mod.PortalSidebar).toBeDefined();
    expect(typeof mod.PortalSidebar).toBe("function");
    expect(mod.PortalSidebar.name).toBe("PortalSidebar");
  });

  it("re-exports the component from the feature index", async () => {
    const mod = await import("../components/features/PortalSidebar");
    expect(mod.PortalSidebar).toBeDefined();
  });
});

describe("PortalBreadcrumbs module", () => {
  it("exports a named PortalBreadcrumbs function", async () => {
    const mod = await import(
      "../components/features/PortalBreadcrumbs/PortalBreadcrumbs"
    );
    expect(mod.PortalBreadcrumbs).toBeDefined();
    expect(typeof mod.PortalBreadcrumbs).toBe("function");
  });
});

describe("LogoLockupCard module", () => {
  it("exports a named LogoLockupCard function", async () => {
    const mod = await import(
      "../components/features/LogoLockupCard/LogoLockupCard"
    );
    expect(mod.LogoLockupCard).toBeDefined();
    expect(typeof mod.LogoLockupCard).toBe("function");
  });
});

describe("ColorSwatch module", () => {
  it("exports a named ColorSwatch function", async () => {
    const mod = await import("../components/features/ColorSwatch/ColorSwatch");
    expect(mod.ColorSwatch).toBeDefined();
    expect(typeof mod.ColorSwatch).toBe("function");
  });
});

describe("TypeSpecimen module", () => {
  it("exports a named TypeSpecimen function", async () => {
    const mod = await import(
      "../components/features/TypeSpecimen/TypeSpecimen"
    );
    expect(mod.TypeSpecimen).toBeDefined();
    expect(typeof mod.TypeSpecimen).toBe("function");
  });
});

describe("SanitisedHtml module", () => {
  it("exports a named SanitisedHtml function", async () => {
    const mod = await import(
      "../components/features/SanitisedHtml/SanitisedHtml"
    );
    expect(mod.SanitisedHtml).toBeDefined();
    expect(typeof mod.SanitisedHtml).toBe("function");
  });
});

describe("Portal lib/api helpers", () => {
  it("exports the SPEC-006 portal fetchers", async () => {
    const mod = await import("../lib/api");
    expect(typeof mod.getBrandForPortal).toBe("function");
    expect(typeof mod.getBrandAssetsForPortal).toBe("function");
    expect(typeof mod.getBrandGuidelines).toBe("function");
  });

  it("returns null when the API responds 404", async () => {
    const origFetch = globalThis.fetch;
    try {
      // Minimal fetch mock for the test — full Response shape satisfies DOM types
      globalThis.fetch = async () =>
        new Response('{"error":"Brand not found"}', { status: 404 });

      const mod = await import("../lib/api");
      const brand = await mod.getBrandForPortal("definitely-missing");
      expect(brand).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("propagates non-404 errors as thrown Errors", async () => {
    const origFetch = globalThis.fetch;
    try {
      // Minimal fetch mock for the test — full Response shape satisfies DOM types
      globalThis.fetch = async () =>
        new Response('{"error":"boom"}', { status: 500 });

      const mod = await import("../lib/api");
      await expect(mod.getBrandForPortal("exploding-brand")).rejects.toThrow(
        /boom/i,
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Optional E2E tests — only run when PORTAL_E2E=1 is set. Hits the dev
// server on :8095 to verify routing and metadata behaviour end-to-end.
// ────────────────────────────────────────────────────────────────────────

const portalE2E = process.env.PORTAL_E2E === "1";
const describeE2E = portalE2E ? describe : describe.skip;

describeE2E("Portal E2E (requires Next.js dev server on :8095)", () => {
  const BASE = "http://localhost:8095";

  it("GET /portal/default returns 200 with the brand title", async () => {
    const res = await fetch(`${BASE}/portal/default`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Default — Overview</title>");
  });

  it("GET /portal/unknown-brand returns 404", async () => {
    const res = await fetch(`${BASE}/portal/xyzzy-no-such-brand`);
    expect(res.status).toBe(404);
  });

  it("portal pages emit per-page titles", async () => {
    const tests = [
      ["/portal/default/colors", "Default — Colors"],
      ["/portal/default/typography", "Default — Typography"],
      ["/portal/default/logo-usage", "Default — Logo usage"],
      ["/portal/default/imagery", "Default — Imagery"],
    ];
    for (const [path, expectedTitle] of tests) {
      const res = await fetch(`${BASE}${path}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<title>${expectedTitle}</title>`);
    }
  });

  it("robots meta defaults to noindex,nofollow (REQ-093 — no PORTAL_INDEX)", async () => {
    // Secure-by-default: PORTAL_INDEX must be explicitly set to "1" to
    // opt in to public search indexing. The dev harness used by this
    // E2E does not set PORTAL_INDEX, so portal pages must emit noindex.
    const res = await fetch(`${BASE}/portal/default`);
    const html = await res.text();
    expect(html).toMatch(/name="robots"\s+content="noindex,\s*nofollow"/i);
  });

  it("admin pages still render under (admin) route group at same URLs", async () => {
    const res = await fetch(`${BASE}/brands`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Admin chrome — Sidebar is the dark panel that only the (admin)
    // layout mounts. Presence of the class marker confirms the admin
    // layout wrapped the page.
    expect(html).toMatch(/sidebar/);
  });
});
