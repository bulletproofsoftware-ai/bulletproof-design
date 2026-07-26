/**
 * SPEC-002 — GET/PUT /api/brands/:slug/guidelines integration tests.
 *
 * These tests spin up a minimal Express app with the brands router mounted
 * against a temporary brands directory. This avoids coupling to the
 * long-lived API server used by __tests__/api.test.ts and lets us assert
 * 401/404/413/415 behaviour deterministically.
 */

import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import brandsRouter from "../src/api/routes/brands";
import { buildBrandIndex, closeWatcher } from "../src/api/lib/brandIndex";

const TMP_ROOT = fs.mkdtempSync(fs.mkdtempSync(path.join(os.tmpdir(), "design-lib-guidelines-api-")));

// Per-run random API key so no literal secret material sits in the source.
const API_KEY = `test-${randomBytes(16).toString("hex")}`;

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const DEFAULT_BRAND = {
  name: "Default Brand",
  slug: "default",
  description: "A default directory brand used for guidelines tests",
  colors: {
    primary: {
      blue: { hex: "#0057B8", rgb: [0, 87, 184], role: "Primary" },
    },
  },
  fonts: { heading: "Inter", body: "Inter" },
  spacing: { unit: 4, scale: [0, 4, 8, 16, 24, 32] },
  borderRadius: { small: "4px", medium: "8px", large: "16px", full: "9999px" },
  shadows: { small: "none", medium: "none", large: "none" },
};

const VALID_GUIDELINES = `---
title: Default Brand Guidelines
version: 1
---

## Voice

Be concise.

### Do
- Use active voice
- Keep sentences short

### Don't
- Use jargon
- Be passive
`;

// ────────────────────────────────────────────────────────────────────────
// Test server lifecycle
// ────────────────────────────────────────────────────────────────────────

let server: Server | null = null;
let baseUrl = "";

beforeAll(async () => {
  // Create the brands tree.
  await fsp.mkdir(path.join(TMP_ROOT, "default"), { recursive: true });
  await fsp.writeFile(
    path.join(TMP_ROOT, "default", "brand.json"),
    JSON.stringify(DEFAULT_BRAND, null, 2),
  );
  await fsp.writeFile(
    path.join(TMP_ROOT, "default", "guidelines.md"),
    VALID_GUIDELINES,
  );

  // Also create a brand directory WITHOUT guidelines.md, to test 404-for-missing-file.
  await fsp.mkdir(path.join(TMP_ROOT, "noguide"), { recursive: true });
  await fsp.writeFile(
    path.join(TMP_ROOT, "noguide", "brand.json"),
    JSON.stringify({ ...DEFAULT_BRAND, slug: "noguide", name: "No Guide" }, null, 2),
  );

  // Point the brand index at our temp dir before building.
  process.env.BRANDS_DIR = TMP_ROOT;
  process.env.DESIGN_API_KEY = API_KEY;
  buildBrandIndex(TMP_ROOT);

  const app = express();
  // JSON parser mirroring server.ts. text/markdown bodies bypass this by
  // content-type match and are consumed by the PUT route's own text parser.
  app.use(express.json({ limit: "1mb" }));

  // API-key gate mirroring server.ts, applied only to write methods.
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const provided = req.headers["x-api-key"];
    if (typeof provided === "string" && provided === API_KEY) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

  app.use("/api/brands", brandsRouter);

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

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

describe("GET /api/brands/:slug/guidelines", () => {
  test("returns parsed JSON sections", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toMatchObject({ title: "Default Brand Guidelines", version: 1 });
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].title).toBe("Voice");
    expect(body.sections[0].slug).toBe("voice");
    expect(body.sections[0].dos).toEqual(["Use active voice", "Keep sentences short"]);
    expect(body.sections[0].donts).toEqual(["Use jargon", "Be passive"]);
  });

  test("?raw=1 returns raw Markdown with text/markdown content-type", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines?raw=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
    const text = await res.text();
    expect(text).toBe(VALID_GUIDELINES);
  });

  test("?raw=true also returns raw Markdown", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines?raw=true`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
    const text = await res.text();
    expect(text).toBe(VALID_GUIDELINES);
  });

  test("without ?raw still returns parsed JSON (regression guard)", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBe(true);
  });

  test("unknown slug → 404 with {error, slug}", async () => {
    const res = await fetch(`${baseUrl}/api/brands/unknown/guidelines`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Brand not found", slug: "unknown" });
  });

  test("known brand with no guidelines.md → 404 with file-not-found message", async () => {
    const res = await fetch(`${baseUrl}/api/brands/noguide/guidelines`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/guidelines\.md not found/);
    expect(body.slug).toBe("noguide");
  });

  test("slug with path traversal attempt → 400", async () => {
    const res = await fetch(`${baseUrl}/api/brands/..%2Fetc/guidelines`);
    // Express normalizes some URL forms; the slug validator rejects the rest.
    expect([400, 404]).toContain(res.status);
  });
});

describe("PUT /api/brands/:slug/guidelines", () => {
  test("without API key → 401", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: "## New\n\nBody.",
    });
    expect(res.status).toBe(401);
  });

  test("with API key + valid body → 200 + file updated + audit emitted", async () => {
    const newMd = `---
title: Updated
---

## Section A

Updated body.
`;
    // Capture audit log output.
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown, ...rest: unknown[]) => {
      logs.push(String(msg));
      origLog.call(console, msg, ...rest);
    };

    try {
      const res = await fetch(`${baseUrl}/api/brands/default/guidelines`, {
        method: "PUT",
        headers: {
          "Content-Type": "text/markdown",
          "X-Api-Key": API_KEY,
        },
        body: newMd,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        ok: true,
        slug: "default",
        bytes: newMd.length,
      });

      // File written to disk?
      const onDisk = await fsp.readFile(
        path.join(TMP_ROOT, "default", "guidelines.md"),
        "utf-8",
      );
      expect(onDisk).toBe(newMd);

      // Audit event emitted?
      const auditLine = logs.find((l) => l.startsWith("[audit]"));
      expect(auditLine).toBeDefined();
      expect(auditLine).toContain("success");
      expect(auditLine).toContain("guidelines.updated");
    } finally {
      console.log = origLog;
      // Restore the original guidelines so later tests pass.
      await fsp.writeFile(
        path.join(TMP_ROOT, "default", "guidelines.md"),
        VALID_GUIDELINES,
      );
    }
  });

  test("text/plain is also accepted", async () => {
    const body = "## Plain\n\nHello.";
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
        "X-Api-Key": API_KEY,
      },
      body,
    });
    expect(res.status).toBe(200);
    // restore
    await fsp.writeFile(
      path.join(TMP_ROOT, "default", "guidelines.md"),
      VALID_GUIDELINES,
    );
  });

  test("rejects body > 100 KB with 413", async () => {
    // 110 KB of content.
    const big = "a".repeat(110 * 1024);
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`, {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown",
        "X-Api-Key": API_KEY,
      },
      body: big,
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
    expect(body.maxBytes).toBe(100 * 1024);
  });

  test("rejects application/json with 415", async () => {
    const res = await fetch(`${baseUrl}/api/brands/default/guidelines`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
      },
      body: JSON.stringify({ content: "## X" }),
    });
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toMatch(/text\/markdown/i);
  });

  test("rejects PUT when brand directory does not exist → 404", async () => {
    const res = await fetch(`${baseUrl}/api/brands/nonexistent/guidelines`, {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown",
        "X-Api-Key": API_KEY,
      },
      body: "## New\n\nBody.",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Brand directory not found/i);
    expect(body.slug).toBe("nonexistent");
  });

  test("invalid slug (uppercase) → 400", async () => {
    const res = await fetch(`${baseUrl}/api/brands/INVALID/guidelines`, {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown",
        "X-Api-Key": API_KEY,
      },
      body: "## X",
    });
    expect(res.status).toBe(400);
  });

  test("REQ-090 — concurrent PUTs against the same slug serialise via withBrandLock", async () => {
    // Fire N concurrent PUTs with distinct bodies. Every request must
    // succeed (200), and the final file must equal one of the submitted
    // bodies in full (no interleaved bytes). With no lock, two writers
    // racing the tmp-then-rename sequence could leave a torn file or
    // surface a 500. With the lock, each PUT runs end-to-end before the
    // next begins.
    const N = 6;
    const bodies = Array.from({ length: N }, (_, i) =>
      `---\ntitle: Concurrent ${i}\n---\n\n## Section ${i}\n\nBody ${i}.\n`,
    );

    // Capture the audit stream to verify the contention warning fires.
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: unknown, ...rest: unknown[]) => {
      logs.push(String(msg));
      origLog.call(console, msg, ...rest);
    };

    try {
      const responses = await Promise.all(
        bodies.map((body) =>
          fetch(`${baseUrl}/api/brands/default/guidelines`, {
            method: "PUT",
            headers: {
              "Content-Type": "text/markdown",
              "X-Api-Key": API_KEY,
            },
            body,
          }),
        ),
      );

      // Every PUT must succeed — no 500 from a torn temp-rename.
      for (const r of responses) {
        expect(r.status).toBe(200);
      }

      // Final on-disk content must match ONE of the N submitted bodies
      // verbatim. This proves writes serialised (no byte interleave).
      const onDisk = await fsp.readFile(
        path.join(TMP_ROOT, "default", "guidelines.md"),
        "utf-8",
      );
      expect(bodies).toContain(onDisk);

      // At least one contention warning must have been emitted (we fired
      // 6 simultaneous PUTs, so at least 5 should have hit the "lock
      // held" branch).
      const contentionLines = logs.filter((l) =>
        l.includes("brand.write.concurrent"),
      );
      expect(contentionLines.length).toBeGreaterThan(0);
    } finally {
      console.log = origLog;
      // restore original fixture for any later tests
      await fsp.writeFile(
        path.join(TMP_ROOT, "default", "guidelines.md"),
        VALID_GUIDELINES,
      );
    }
  });
});
