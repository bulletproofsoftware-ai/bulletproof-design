/**
 * SPEC-013 REQ-072 + REQ-070 — Backward compatibility for brand endpoints.
 *
 * Verifies every existing brand endpoint works identically against BOTH
 * brand storage shapes:
 *
 *   - Flat: `brands/<slug>.json`
 *   - Directory: `brands/<slug>/brand.json` (+ optional guidelines.md + assets/)
 *
 * The public response shape must not drift between formats. For endpoints
 * that expose format-aware fields (e.g. `/assets` returns a `logos` manifest
 * only for directory brands), we assert the format-specific expectations
 * explicitly per-case.
 *
 * Pattern mirrors `api.logos.test.ts` — ephemeral Express app, temp brands
 * directory, no live API server required.
 */

import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import brandsRouter, {
  brandAssetsStaticRouter,
} from "../src/api/routes/brands";
import { buildBrandIndex, closeWatcher } from "../src/api/lib/brandIndex";

// ────────────────────────────────────────────────────────────────────────
// Fixtures — one flat brand + one directory brand, shared across tests
// ────────────────────────────────────────────────────────────────────────

const TMP_ROOT = path.join(
  os.tmpdir(),
  "design-lib-api-backcompat-" + Date.now(),
);

const FLAT_BRAND = {
  name: "Flat Brand",
  slug: "flat-brand",
  description: "Legacy flat-format brand",
  colors: {
    primary: "#0057B8",
    secondary: "#009CA6",
    accent: "#EFE4C9",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    error: "#dc2626",
    warning: "#f59e0b",
    success: "#16a34a",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 16, 24, 32] },
  borderRadius: { small: "4px", medium: "8px", large: "16px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
  logo: {
    mark: "flat-brand-mark.svg",
    horizontal: "flat-brand-horizontal.svg",
    favicon: "flat-brand-favicon.svg",
  },
};

const DIR_BRAND = {
  name: "Directory Brand",
  slug: "dir-brand",
  description: "Expanded directory-format brand",
  colors: {
    primary: {
      blue: { hex: "#0057B8", rgb: [0, 87, 184], role: "Primary" },
    },
    medium: {
      teal: { hex: "#009CA6", rgb: [0, 156, 166], role: "Support" },
    },
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 16, 24, 32] },
  borderRadius: { small: "4px", medium: "8px", large: "16px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
  logos: {
    horizontal: {
      file: "horizontal.svg",
      label: "Horizontal",
      usage: "Default in most contexts",
      preferred: true,
    },
  },
  typography: {
    headings: {
      family: "Inter",
      weights: [400, 700],
      scale: {
        h1: { size: "48px", lineHeight: "56px", weight: 700 },
      },
    },
  },
};

const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>`;

let server: Server | null = null;
let baseUrl = "";

beforeAll(async () => {
  // ─── Flat brand ──────────────────────────────────────────────────
  await fsp.mkdir(TMP_ROOT, { recursive: true });
  await fsp.writeFile(
    path.join(TMP_ROOT, "flat-brand.json"),
    JSON.stringify(FLAT_BRAND, null, 2),
  );

  // ─── Directory brand ─────────────────────────────────────────────
  const dirRoot = path.join(TMP_ROOT, "dir-brand");
  await fsp.mkdir(path.join(dirRoot, "assets"), { recursive: true });
  await fsp.writeFile(
    path.join(dirRoot, "brand.json"),
    JSON.stringify(DIR_BRAND, null, 2),
  );
  await fsp.writeFile(path.join(dirRoot, "guidelines.md"), "# Directory Brand\n\nHello.\n");
  await fsp.writeFile(path.join(dirRoot, "assets", "horizontal.svg"), CLEAN_SVG);

  process.env.BRANDS_DIR = TMP_ROOT;
  buildBrandIndex(TMP_ROOT);

  const app = express();
  app.use(express.json());
  app.use("/api/brands", brandsRouter);
  app.use("/brand-assets", brandAssetsStaticRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  closeWatcher();
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch {
    // best effort
  }
});

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

// Tests intentionally use `any` for response bodies — they assert shape
// via runtime expectations, not static types. Matches the pattern used by
// api.logos.test.ts and api.guidelines.test.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJson(urlPath: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${urlPath}`);
  const body = await res.json();
  return { status: res.status, body };
}

// ────────────────────────────────────────────────────────────────────────
// Tests — parameterised over both brand shapes where responses should match
// ────────────────────────────────────────────────────────────────────────

describe("Brand endpoints — REQ-070 backward compatibility across storage formats", () => {
  test("GET /api/brands includes both flat and directory brands", async () => {
    const { status, body } = await getJson("/api/brands");
    expect(status).toBe(200);
    const slugs = body.brands.map((b: { slug: string }) => b.slug).sort();
    expect(slugs).toEqual(["dir-brand", "flat-brand"]);
    // Summary shape is identical regardless of source format.
    for (const b of body.brands) {
      expect(b).toHaveProperty("name");
      expect(b).toHaveProperty("slug");
      expect(b).toHaveProperty("description");
      expect(b).toHaveProperty("primaryColor");
      expect(typeof b.primaryColor).toBe("string");
    }
  });

  describe.each([
    ["flat-brand", "flat colors"],
    ["dir-brand", "role-grouped colors"],
  ])("brand-aware endpoints — %s", (slug) => {
    test(`GET /api/brands/${slug} returns a full config`, async () => {
      const { status, body } = await getJson(`/api/brands/${slug}`);
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(body.name).toBeTruthy();
      expect(body.colors).toBeTruthy();
      expect(body.fonts).toBeTruthy();
      // `_source` is stripped from the public response.
      expect(body._source).toBeUndefined();
    });

    test(`GET /api/brands/${slug}/colors tags shape flat|role-grouped`, async () => {
      const { status, body } = await getJson(
        `/api/brands/${slug}/colors`,
      );
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(["flat", "role-grouped"]).toContain(body.shape);
      if (slug === "flat-brand") expect(body.shape).toBe("flat");
      else expect(body.shape).toBe("role-grouped");
    });

    test(`GET /api/brands/${slug}/fonts returns heading/body/mono`, async () => {
      const { status, body } = await getJson(`/api/brands/${slug}/fonts`);
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(body.fonts.heading).toBeTruthy();
      expect(body.fonts.body).toBeTruthy();
    });

    test(`GET /api/brands/${slug}/css-variables returns text/css with --tokens`, async () => {
      const res = await fetch(`${baseUrl}/api/brands/${slug}/css-variables`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/text\/css/);
      const css = await res.text();
      expect(css).toContain("--");
      expect(css.length).toBeGreaterThan(0);
    });

    test(`GET /api/brands/${slug}/identity returns colors+typography+logos`, async () => {
      const { status, body } = await getJson(
        `/api/brands/${slug}/identity`,
      );
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(body).toHaveProperty("colors");
      expect(body).toHaveProperty("typography");
      expect(body).toHaveProperty("logos");
      // Flat brands have no typography block; directory brands do.
      if (slug === "flat-brand") {
        expect(body.typography).toBeNull();
        expect(body.logos).toEqual({});
      } else {
        expect(body.typography).toBeTruthy();
        expect(body.logos.horizontal).toBeTruthy();
        expect(body.logos.horizontal.url).toMatch(
          /\/brand-assets\/dir-brand\/horizontal\.svg$/,
        );
      }
    });

    test(`GET /api/brands/${slug}/logos returns URL-augmented map`, async () => {
      const { status, body } = await getJson(
        `/api/brands/${slug}/logos`,
      );
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(body.logos).toBeTruthy();
    });

    test(`GET /api/brands/${slug}/typography returns block or null`, async () => {
      const { status, body } = await getJson(
        `/api/brands/${slug}/typography`,
      );
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      if (slug === "flat-brand") expect(body.typography).toBeNull();
      else expect(body.typography).toBeTruthy();
    });

    test(`GET /api/brands/${slug}/assets returns assets object`, async () => {
      const { status, body } = await getJson(
        `/api/brands/${slug}/assets`,
      );
      expect(status).toBe(200);
      expect(body.slug).toBe(slug);
      expect(typeof body.assets).toBe("object");
      // Directory brands additionally surface the `logos` manifest.
      if (slug === "dir-brand") {
        expect(body.logos).toBeTruthy();
        expect(body.logos.horizontal).toBeTruthy();
      }
    });
  });

  // ── Format-specific assertions ──────────────────────────────────────

  test("directory brand serves its assets via /brand-assets/:slug/:file", async () => {
    const res = await fetch(`${baseUrl}/brand-assets/dir-brand/horizontal.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/image\/svg\+xml/);
    const text = await res.text();
    expect(text).toMatch(/<circle/);
  });

  test("flat brand has no /brand-assets directory — returns 404", async () => {
    const res = await fetch(`${baseUrl}/brand-assets/flat-brand/mark.svg`);
    expect(res.status).toBe(404);
  });

  test("GET /api/brands/dir-brand/guidelines returns parsed JSON", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/dir-brand/guidelines`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // guidelinesParser returns a structured shape — at minimum an array/obj.
    expect(body).toBeTruthy();
  });

  test("GET /api/brands/flat-brand/guidelines returns 404 (no guidelines.md)", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/flat-brand/guidelines`,
    );
    expect(res.status).toBe(404);
  });
});
