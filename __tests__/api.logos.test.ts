/**
 * SPEC-004 — Integration tests for the brand identity/logos/typography API.
 *
 * Mirrors the pattern used by `api.guidelines.test.ts`: spin up a minimal
 * Express app with the brands router mounted against a temporary brands
 * directory so we can assert 401/404/413/415 behaviour deterministically
 * without coupling to the long-lived API server.
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
} from "../src/api/routes/brands";
import { buildBrandIndex, closeWatcher } from "../src/api/lib/brandIndex";

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const TMP_ROOT = path.join(
  os.tmpdir(),
  "design-lib-logos-api-" + Date.now(),
);

const API_KEY = `test-${randomBytes(16).toString("hex")}`;

const DEFAULT_BRAND = {
  name: "Default Brand",
  slug: "default",
  description: "A default directory brand used for logo tests",
  colors: {
    primary: {
      blue: { hex: "#0057B8", rgb: [0, 87, 184], role: "Primary" },
    },
  },
  fonts: { heading: "Inter", body: "Inter" },
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

const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0057B8"/></svg>`;

const CLEAN_SVG_ALT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#f59e0b"/></svg>`;

const MALICIOUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>`;

// ────────────────────────────────────────────────────────────────────────
// Test server lifecycle
// ────────────────────────────────────────────────────────────────────────

let server: Server | null = null;
let baseUrl = "";

async function resetBrandJson(): Promise<void> {
  // Used to restore fixture state between tests that mutate the brand.
  await fsp.writeFile(
    path.join(TMP_ROOT, "default", "brand.json"),
    JSON.stringify(DEFAULT_BRAND, null, 2),
  );
  // Wipe any assets left behind by a previous test.
  const assetsDir = path.join(TMP_ROOT, "default", "assets");
  try {
    const entries = await fsp.readdir(assetsDir);
    await Promise.all(entries.map((e) => fsp.unlink(path.join(assetsDir, e))));
  } catch {
    // best-effort
  }
  // Rebuild the index so getBySlug returns fresh data.
  buildBrandIndex(TMP_ROOT);
}

beforeAll(async () => {
  await fsp.mkdir(path.join(TMP_ROOT, "default", "assets"), { recursive: true });
  await fsp.writeFile(
    path.join(TMP_ROOT, "default", "brand.json"),
    JSON.stringify(DEFAULT_BRAND, null, 2),
  );
  // Flat brand — used to exercise the 409 path for flat-brand logo uploads.
  await fsp.writeFile(
    path.join(TMP_ROOT, "flat-one.json"),
    JSON.stringify({
      ...DEFAULT_BRAND,
      slug: "flat-one",
      name: "Flat One",
      typography: undefined,
    }),
  );

  process.env.BRANDS_DIR = TMP_ROOT;
  process.env.DESIGN_API_KEY = API_KEY;
  buildBrandIndex(TMP_ROOT);

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // API-key gate mirroring server.ts, applied only to write methods.
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
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
  delete process.env.DESIGN_API_KEY;
});

beforeEach(async () => {
  await resetBrandJson();
});

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * Build a multipart/form-data body manually. Jest's `FormData` polyfill is
 * present on Node 18+, but this helper gives us deterministic ordering and
 * lets us assert exact bytes when needed.
 */
function makeMultipart(
  fields: Array<{
    name: string;
    value: string;
    filename?: string;
    contentType?: string;
  }>,
): { body: Buffer; contentType: string } {
  const boundary = "----TestBoundary" + randomBytes(6).toString("hex");
  const parts: Buffer[] = [];
  for (const field of fields) {
    const headers: string[] = [];
    if (field.filename) {
      headers.push(
        `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"`,
      );
      headers.push(`Content-Type: ${field.contentType ?? "application/octet-stream"}`);
    } else {
      headers.push(`Content-Disposition: form-data; name="${field.name}"`);
    }
    parts.push(Buffer.from(`--${boundary}\r\n${headers.join("\r\n")}\r\n\r\n`, "utf-8"));
    parts.push(Buffer.from(field.value, "utf-8"));
    parts.push(Buffer.from("\r\n", "utf-8"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf-8"));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function postLogo(
  slug: string,
  options: {
    apiKey?: string;
    file?: { name: string; content: string | Buffer; contentType: string };
    fields?: Record<string, string>;
  },
): Promise<Response> {
  const fields = options.fields ?? {};
  const parts: Array<{
    name: string;
    value: string;
    filename?: string;
    contentType?: string;
  }> = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push({ name: k, value: v });
  }
  if (options.file) {
    parts.push({
      name: "file",
      value:
        typeof options.file.content === "string"
          ? options.file.content
          : options.file.content.toString("utf-8"),
      filename: options.file.name,
      contentType: options.file.contentType,
    });
  }
  const { body, contentType } = makeMultipart(parts);
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (options.apiKey) headers["X-Api-Key"] = options.apiKey;
  // Node 18+ `fetch` accepts a Buffer at runtime, but the global type wants
  // BodyInit — cast to Uint8Array which satisfies both.
  return fetch(`${baseUrl}/api/brands/${slug}/logos`, {
    method: "POST",
    headers,
    body: new Uint8Array(body) as unknown as BodyInit,
  });
}

// ────────────────────────────────────────────────────────────────────────
// GET routes
// ────────────────────────────────────────────────────────────────────────

describe("GET /api/brands/:slug/identity", () => {
  test("returns {colors, typography, logos} with URLs", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/identity`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("default");
    expect(body.colors).toBeDefined();
    expect(body.typography).toBeDefined();
    expect(body.typography.headings.family).toBe("Inter");
    expect(body.logos).toEqual({});
  });

  test("unknown slug → 404 normalized shape (REQ-079)", async () => {
    const res = await fetch(`${baseUrl}/api/brands/unknown-xyz/identity`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Brand not found", slug: "unknown-xyz" });
  });
});

describe("GET /api/brands/:slug/logos", () => {
  test("returns logos object (empty when none registered)", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/logos`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("default");
    expect(body.logos).toEqual({});
  });

  test("unknown slug → 404", async () => {
    const res = await fetch(`${baseUrl}/api/brands/unknown-xyz/logos`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/brands/:slug/typography", () => {
  test("returns typography block", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/typography`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.typography.headings.family).toBe("Inter");
  });

  test("returns null when typography absent", async () => {
    const res = await fetch(`${baseUrl}/api/brands/flat-one/typography`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.typography).toBeNull();
  });

  test("unknown slug → 404", async () => {
    const res = await fetch(`${baseUrl}/api/brands/unknown-xyz/typography`);
    expect(res.status).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────────────────
// POST /logos — auth and validation
// ────────────────────────────────────────────────────────────────────────

describe("POST /api/brands/:slug/logos — auth and validation", () => {
  test("without API key → 401", async () => {
    const res = await postLogo("default", {
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "Horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(401);
  });

  test("unknown slug → 404 normalized (REQ-079)", async () => {
    const res = await postLogo("nonexistent-slug", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "Horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: "Brand not found",
      slug: "nonexistent-slug",
    });
  });

  test("missing file field → 400", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      fields: { key: "horizontal", label: "Horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(400);
  });

  test("invalid MIME type → 415", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: {
        name: "evil.pdf",
        content: Buffer.from("%PDF-1.4\n"),
        contentType: "application/pdf",
      },
      fields: { key: "horizontal", label: "Horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(415);
  });

  test("invalid key → 400", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "banner", label: "Bogus", usage: "Bogus" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.allowed).toEqual(["horizontal", "vertical", "icon"]);
  });

  test("missing label → 400", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(400);
  });

  test("label too long → 400", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "x".repeat(200),
        usage: "Light bg",
      },
    });
    expect(res.status).toBe(400);
  });

  test("payload too large (6 MB SVG) → 413", async () => {
    // Build a ~5.5 MB SVG by padding a rect's data attribute with filler.
    const padding = "x".repeat(5.5 * 1024 * 1024);
    const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc>${padding}</desc></svg>`;
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: big, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "Horizontal", usage: "Light bg" },
    });
    expect(res.status).toBe(413);
  }, 30_000);
});

// ────────────────────────────────────────────────────────────────────────
// POST /logos — happy path and security
// ────────────────────────────────────────────────────────────────────────

describe("POST /api/brands/:slug/logos — happy path", () => {
  test("valid SVG upload → 201, file on disk, brand.json updated", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "Horizontal wordmark",
        usage: "Use on light backgrounds",
        preferred: "true",
      },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.slug).toBe("default");
    expect(body.key).toBe("horizontal");
    expect(body.file).toMatch(/^horizontal-[0-9a-f]{12}\.svg$/);
    expect(body.url).toBe(`/brand-assets/default/${body.file}`);

    // File on disk
    const onDisk = await fsp.readFile(
      path.join(TMP_ROOT, "default", "assets", body.file),
      "utf-8",
    );
    expect(onDisk).toMatch(/<circle/);

    // brand.json updated
    const raw = await fsp.readFile(
      path.join(TMP_ROOT, "default", "brand.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.logos.horizontal).toEqual({
      file: body.file,
      label: "Horizontal wordmark",
      usage: "Use on light backgrounds",
      preferred: true,
    });
  });

  test("SVG with <script> is sanitized before write (CISO F-UPLOAD-01)", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "m.svg", content: MALICIOUS_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "Mal", usage: "Evil" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    const onDisk = await fsp.readFile(
      path.join(TMP_ROOT, "default", "assets", body.file),
      "utf-8",
    );
    expect(onDisk).not.toMatch(/<script/i);
    expect(onDisk).not.toMatch(/alert\(1\)/);
  });

  test("PNG upload is accepted without sanitization", async () => {
    // Minimal valid PNG (8-byte signature + IHDR + IDAT + IEND).
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000100000005000100" +
        "0d0a2db40000000049454e44ae426082",
      "hex",
    );
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "icon.png", content: png, contentType: "image/png" },
      fields: { key: "icon", label: "Icon", usage: "App tile" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.file).toMatch(/^icon-[0-9a-f]{12}\.png$/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Content-addressable filenames (CISO F-UPLOAD-03)
// ────────────────────────────────────────────────────────────────────────

describe("POST /api/brands/:slug/logos — content-addressable filenames", () => {
  test("identical content + different user filename → same on-disk name", async () => {
    const a = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "a.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "A",
        usage: "Primary",
        filename: "one.svg",
      },
    });
    expect(a.status).toBe(201);
    const aBody = await a.json();

    const b = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "b.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "A",
        usage: "Primary",
        filename: "two.svg",
      },
    });
    expect(b.status).toBe(201);
    const bBody = await b.json();

    expect(aBody.file).toBe(bBody.file);
  });

  test("different content + same user filename → different on-disk names", async () => {
    const a = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "same.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "A",
        usage: "Primary",
        filename: "same.svg",
      },
    });
    const b = await postLogo("default", {
      apiKey: API_KEY,
      file: {
        name: "same.svg",
        content: CLEAN_SVG_ALT,
        contentType: "image/svg+xml",
      },
      fields: {
        key: "vertical",
        label: "V",
        usage: "Vertical",
        filename: "same.svg",
      },
    });
    const aBody = await a.json();
    const bBody = await b.json();
    expect(aBody.file).not.toBe(bBody.file);
  });

  test("filename=../../etc/passwd is ignored; server-computed name used", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "H",
        usage: "Primary",
        filename: "../../etc/passwd",
      },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Server-computed name, no traversal component.
    expect(body.file).toMatch(/^horizontal-[0-9a-f]{12}\.svg$/);
    expect(body.file).not.toContain("..");
    expect(body.file).not.toContain("/");

    // No file created outside assets/.
    const outside = path.join(TMP_ROOT, "default", "etc", "passwd");
    expect(fs.existsSync(outside)).toBe(false);
  });

  test("brand.json logos[key].file is always the content-addressable name", async () => {
    const res = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: {
        key: "horizontal",
        label: "H",
        usage: "Primary",
        filename: "user-supplied-name.svg",
      },
    });
    const body = await res.json();
    const raw = await fsp.readFile(
      path.join(TMP_ROOT, "default", "brand.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.logos.horizontal.file).toBe(body.file);
    expect(config.logos.horizontal.file).toMatch(/^horizontal-[0-9a-f]{12}\.svg$/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Per-slug advisory write lock (CISO F-UPLOAD-04)
// ────────────────────────────────────────────────────────────────────────

describe("POST /api/brands/:slug/logos — per-slug advisory write lock", () => {
  test("two concurrent uploads for same slug both succeed; both entries present", async () => {
    // Two different contents (so they write different files) with different
    // keys so the final brand.json contains both.
    const [a, b] = await Promise.all([
      postLogo("default", {
        apiKey: API_KEY,
        file: { name: "a.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
        fields: { key: "horizontal", label: "H", usage: "Primary" },
      }),
      postLogo("default", {
        apiKey: API_KEY,
        file: {
          name: "b.svg",
          content: CLEAN_SVG_ALT,
          contentType: "image/svg+xml",
        },
        fields: { key: "vertical", label: "V", usage: "Alt" },
      }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const raw = await fsp.readFile(
      path.join(TMP_ROOT, "default", "brand.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.logos.horizontal).toBeDefined();
    expect(config.logos.vertical).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────
// DELETE /logos/:key
// ────────────────────────────────────────────────────────────────────────

describe("DELETE /api/brands/:slug/logos/:key", () => {
  test("without API key → 401", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/default/logos/horizontal`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(401);
  });

  test("unknown slug → 404", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/unknown-xyz/logos/horizontal`,
      {
        method: "DELETE",
        headers: { "X-Api-Key": API_KEY },
      },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.slug).toBe("unknown-xyz");
  });

  test("unknown key → 404 with normalized shape", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/default/logos/horizontal`,
      {
        method: "DELETE",
        headers: { "X-Api-Key": API_KEY },
      },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Logo key not registered/);
    expect(body.key).toBe("horizontal");
  });

  test("invalid key name → 400", async () => {
    const res = await fetch(
      `${baseUrl}/api/brands/default/logos/banner`,
      {
        method: "DELETE",
        headers: { "X-Api-Key": API_KEY },
      },
    );
    expect(res.status).toBe(400);
  });

  test("happy path: upload → delete removes file and entry", async () => {
    const upload = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "H", usage: "Primary" },
    });
    const uploadBody = await upload.json();
    const filePath = path.join(TMP_ROOT, "default", "assets", uploadBody.file);
    expect(fs.existsSync(filePath)).toBe(true);

    const del = await fetch(
      `${baseUrl}/api/brands/default/logos/horizontal`,
      {
        method: "DELETE",
        headers: { "X-Api-Key": API_KEY },
      },
    );
    expect(del.status).toBe(200);
    const delBody = await del.json();
    expect(delBody).toEqual({ ok: true, slug: "default", key: "horizontal" });

    // File removed.
    expect(fs.existsSync(filePath)).toBe(false);

    // brand.json entry removed.
    const raw = await fsp.readFile(
      path.join(TMP_ROOT, "default", "brand.json"),
      "utf-8",
    );
    const config = JSON.parse(raw);
    expect(config.logos?.horizontal).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Static serving (/brand-assets/:slug/:file) + sanitize-on-read
// ────────────────────────────────────────────────────────────────────────

describe("GET /brand-assets/:slug/:file", () => {
  test("serves uploaded SVG with image/svg+xml", async () => {
    const upload = await postLogo("default", {
      apiKey: API_KEY,
      file: { name: "h.svg", content: CLEAN_SVG, contentType: "image/svg+xml" },
      fields: { key: "horizontal", label: "H", usage: "Primary" },
    });
    const body = await upload.json();

    const res = await fetch(`${baseUrl}/brand-assets/default/${body.file}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const text = await res.text();
    expect(text).toMatch(/<circle/);
  });

  test("path traversal attempt → 400", async () => {
    const res = await fetch(
      `${baseUrl}/brand-assets/default/..%2f..%2fetc%2fpasswd`,
    );
    // Express's router normalises `..` so we get either 400 (invalid filename)
    // or 404 (path didn't match). Both are acceptable — the file must NEVER
    // be served.
    expect([400, 404]).toContain(res.status);
  });

  test("missing file → 404", async () => {
    const res = await fetch(
      `${baseUrl}/brand-assets/default/nonexistent-abc123.svg`,
    );
    expect(res.status).toBe(404);
  });

  test(".svgz extension → 404 (bypass prevention)", async () => {
    // Even if somehow written, .svgz must not be served.
    await fsp.writeFile(
      path.join(TMP_ROOT, "default", "assets", "evil.svgz"),
      Buffer.from([0x1f, 0x8b, 0x08]), // gzip magic
    );
    const res = await fetch(`${baseUrl}/brand-assets/default/evil.svgz`);
    expect(res.status).toBe(404);
  });

  test("sanitize-on-read strips <script> injected directly on disk", async () => {
    // Write a malicious SVG directly to assets/ bypassing the upload route.
    const evil = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>`;
    const filename = "hand-placed-abc123.svg";
    await fsp.writeFile(
      path.join(TMP_ROOT, "default", "assets", filename),
      evil,
    );

    const res = await fetch(`${baseUrl}/brand-assets/default/${filename}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/<script/i);
    expect(text).not.toMatch(/alert\(1\)/);
  });

  test("invalid filename characters → 400", async () => {
    const res = await fetch(
      `${baseUrl}/brand-assets/default/bad%20name%20with%20spaces.svg`,
    );
    expect(res.status).toBe(400);
  });
});
