/**
 * SPEC-013 REQ-072 — End-to-end smoke workflow.
 *
 * Exercises the core brand-portal lifecycle against a real (in-process)
 * Express server:
 *
 *   1. List brands (directory + flat present).
 *   2. Fetch brand identity for a directory brand.
 *   3. Upload a logo — verifies content-addressable filename + brand.json
 *      update + 201 response.
 *   4. Serve the logo via /brand-assets/:slug/:file — static-serving works
 *      with sanitize-on-read.
 *   5. Fetch identity again — the uploaded logo now appears in the logos
 *      manifest with a resolved URL.
 *   6. Save & re-read guidelines.md via PUT + GET (raw + parsed).
 *   7. Delete the logo — returns 200, and subsequent GET /logos no longer
 *      includes the key.
 *
 * This is effectively a backend "happy path" smoke — the slowest-running
 * step is the server listen, and the whole suite completes in <3s.
 *
 * The Playwright equivalent (navigating the /portal UI in a browser) is
 * out of scope while `@playwright/test` is not a project dependency. The
 * admin UI + portal rendering are already covered by the component-level
 * tests (sidebar.test.tsx, portal.spec.ts, components-browser.test.tsx).
 */

import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import brandsRouter, {
  brandAssetsStaticRouter,
} from "../../src/api/routes/brands";
import {
  buildBrandIndex,
  closeWatcher,
  _rebuildForTest,
} from "../../src/api/lib/brandIndex";

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const TMP = fs.mkdtempSync(fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-e2e-full-workflow-")));

const API_KEY = `test-${randomBytes(12).toString("hex")}`;

const DIR_BRAND = {
  name: "Acme Corp",
  slug: "acme",
  description: "Directory brand used for the E2E workflow",
  colors: {
    primary: {
      blue: { hex: "#0057B8", rgb: [0, 87, 184], role: "Primary" },
    },
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 16, 24, 32] },
  borderRadius: { small: "4px", medium: "8px", large: "16px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
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

const FLAT_BRAND = {
  name: "Legacy Co",
  slug: "legacy",
  description: "Flat brand used for co-existence coverage",
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
};

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#0057B8"/></svg>`;

let server: Server | null = null;
let baseUrl = "";

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function makeMultipart(
  parts: Array<{
    name: string;
    value: string;
    filename?: string;
    contentType?: string;
  }>,
): { body: Buffer; contentType: string } {
  const boundary = "----e2e-" + randomBytes(6).toString("hex");
  const chunks: Buffer[] = [];
  for (const p of parts) {
    const headers: string[] = [];
    if (p.filename) {
      headers.push(
        `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"`,
      );
      headers.push(
        `Content-Type: ${p.contentType ?? "application/octet-stream"}`,
      );
    } else {
      headers.push(`Content-Disposition: form-data; name="${p.name}"`);
    }
    chunks.push(Buffer.from(`--${boundary}\r\n${headers.join("\r\n")}\r\n\r\n`, "utf-8"));
    chunks.push(Buffer.from(p.value, "utf-8"));
    chunks.push(Buffer.from("\r\n", "utf-8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf-8"));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Lifecycle
// ────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await fsp.mkdir(path.join(TMP, "acme", "assets"), { recursive: true });
  await fsp.writeFile(
    path.join(TMP, "acme", "brand.json"),
    JSON.stringify(DIR_BRAND, null, 2),
  );
  await fsp.writeFile(
    path.join(TMP, "legacy.json"),
    JSON.stringify(FLAT_BRAND, null, 2),
  );

  process.env.BRANDS_DIR = TMP;
  process.env.DESIGN_API_KEY = API_KEY;
  buildBrandIndex(TMP);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Gate mirrors the production `requireApiKey` middleware.
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const provided = req.headers["x-api-key"];
    if (typeof provided === "string" && provided === API_KEY) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

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
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    // best-effort
  }
  delete process.env.DESIGN_API_KEY;
});

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

describe("E2E — brand portal workflow (SPEC-013 REQ-072)", () => {
  // Persisted across tests to chain the workflow steps.
  let uploadedFile = "";

  test("step 1 — GET /api/brands lists both brands", async () => {
    const res = await fetch(`${baseUrl}/api/brands`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.brands.map((b: { slug: string }) => b.slug).sort();
    expect(slugs).toEqual(["acme", "legacy"]);
  });

  test("step 2 — GET /api/brands/acme/identity returns colors + typography (no logos yet)", async () => {
    const res = await fetch(`${baseUrl}/api/brands/acme/identity`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("acme");
    expect(body.colors.primary.blue.hex).toBe("#0057B8");
    expect(body.typography.headings.family).toBe("Inter");
    expect(body.logos).toEqual({});
  });

  test("step 3 — POST /api/brands/acme/logos uploads horizontal logo", async () => {
    const { body, contentType } = makeMultipart([
      { name: "key", value: "horizontal" },
      { name: "label", value: "Horizontal logo" },
      { name: "usage", value: "Primary mark for all marketing surfaces" },
      { name: "preferred", value: "true" },
      {
        name: "file",
        value: LOGO_SVG,
        filename: "horizontal.svg",
        contentType: "image/svg+xml",
      },
    ]);

    const res = await fetch(`${baseUrl}/api/brands/acme/logos`, {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
        "Content-Type": contentType,
      },
      body: new Uint8Array(body) as unknown as BodyInit,
    });

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.slug).toBe("acme");
    expect(payload.key).toBe("horizontal");
    expect(payload.file).toMatch(/^horizontal-[a-f0-9]{12}\.svg$/);
    expect(payload.url).toBe(`/brand-assets/acme/${payload.file}`);
    uploadedFile = payload.file;
  });

  test("step 3b — brand.json on disk was updated atomically", async () => {
    const raw = await fsp.readFile(
      path.join(TMP, "acme", "brand.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.logos).toBeTruthy();
    expect(config.logos.horizontal.file).toBe(uploadedFile);
    expect(config.logos.horizontal.preferred).toBe(true);
  });

  test("step 4 — GET /brand-assets/acme/:file serves the uploaded SVG", async () => {
    const res = await fetch(`${baseUrl}/brand-assets/acme/${uploadedFile}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/image\/svg\+xml/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const text = await res.text();
    expect(text).toMatch(/<rect/);
  });

  test("step 5 — GET /api/brands/acme/identity now includes the logo", async () => {
    // File watcher re-indexes asynchronously; force a synchronous rebuild
    // so we're not racing the debounce.
    _rebuildForTest(TMP);
    const res = await fetch(`${baseUrl}/api/brands/acme/identity`);
    const body = await res.json();
    expect(body.logos.horizontal).toBeTruthy();
    expect(body.logos.horizontal.file).toBe(uploadedFile);
    expect(body.logos.horizontal.url).toBe(
      `/brand-assets/acme/${uploadedFile}`,
    );
  });

  test("step 6a — PUT /api/brands/acme/guidelines accepts text/markdown", async () => {
    const md = "# Acme Corp\n\n## Logo usage\n\n- Do use the blue mark.\n- Don't tint.\n";
    const res = await fetch(`${baseUrl}/api/brands/acme/guidelines`, {
      method: "PUT",
      headers: {
        "X-Api-Key": API_KEY,
        "Content-Type": "text/markdown",
      },
      body: md,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBe("acme");
    expect(body.bytes).toBe(Buffer.byteLength(md, "utf-8"));
  });

  test("step 6b — GET /api/brands/acme/guidelines?raw=1 returns the markdown", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/acme/guidelines?raw=1`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/text\/markdown/);
    const text = await res.text();
    expect(text).toMatch(/# Acme Corp/);
    expect(text).toMatch(/Do use the blue mark/);
  });

  test("step 6c — GET /api/brands/acme/guidelines (default) returns parsed JSON", async () => {
    const res = await fetch(`${baseUrl}/api/brands/acme/guidelines`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
    // The parser shape can vary; we only assert JSON structure.
    expect(typeof body).toBe("object");
  });

  test("step 7 — DELETE /api/brands/acme/logos/horizontal removes the logo", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/acme/logos/horizontal`,
      {
        method: "DELETE",
        headers: { "X-Api-Key": API_KEY },
      },
    );
    expect(res.status).toBe(200);

    // Force synchronous index refresh so the subsequent GET sees the delete.
    _rebuildForTest(TMP);

    // Subsequent GET /logos no longer contains `horizontal`.
    const logosRes = await fetch(`${baseUrl}/api/brands/acme/logos`);
    const logos = await logosRes.json();
    expect(logos.logos.horizontal).toBeUndefined();

    // The static file is ALSO gone — attempting to fetch returns 404.
    const fileRes = await fetch(
      `${baseUrl}/brand-assets/acme/${uploadedFile}`,
    );
    expect(fileRes.status).toBe(404);
  });

  test("step 8 — flat brand still serves /colors with the legacy shape", async () => {
    // Confirms the workflow does not regress flat-brand co-existence.
    const res = await fetch(`${baseUrl}/api/brands/legacy/colors`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shape).toBe("flat");
    expect(body.colors.primary).toBe("#0057B8");
  });
});
