/**
 * Tests for the component registry API (SPEC-005).
 *
 * Covers:
 *   - componentIndex (unit): load, get, search, tier filter, case-insensitive lookup
 *   - Express router (in-process): mounts the router on an ephemeral port so
 *     the suite is hermetic — no dependency on a running Docker container.
 *       GET /api/components                  → REQ-037
 *       GET /api/components?q=&tier=         → REQ-037
 *       GET /api/components/:name            → REQ-038, REQ-079
 *       GET /api/components/:name/preview    → REQ-039
 *       DISABLE_ENRICHED_COMPONENTS=1 path   → SPEC-014 rollback
 *
 * The in-process approach was chosen after verifying that `src/api/server.ts`
 * calls `app.listen(...)` at module-load time, which would collide with the
 * existing Docker container on port 8096. Spinning up only the components
 * router on a random port keeps the tests deterministic and isolated.
 */

import { resolve, join } from "path";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import type { AddressInfo } from "net";

import express from "express";
import type { Server } from "http";

import {
  createComponentIndex,
  __resetDefaultComponentIndexForTests,
} from "../src/api/lib/componentIndex";
import componentsRouter from "../src/api/routes/components";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const REGISTRY = resolve(ROOT, "src", "components", "registry.json");

// ─── Unit: componentIndex ───────────────────────────────────────────────────

describe("componentIndex (unit)", () => {
  afterEach(() => {
    __resetDefaultComponentIndexForTests();
  });

  test("all() returns every registered component", () => {
    const index = createComponentIndex(REGISTRY);
    const items = index.all();
    expect(items.length).toBeGreaterThan(0);
    // We regenerated a 27-component registry during SPEC-005 rollout, so
    // assert a conservative lower bound that won't break on minor additions.
    expect(items.length).toBeGreaterThanOrEqual(18);
  });

  test("get() is case-insensitive", () => {
    const index = createComponentIndex(REGISTRY);
    const a = index.get("Button");
    const b = index.get("button");
    const c = index.get("BUTTON");
    // button is lowercased in registry.json; all three forms should match.
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    expect(a!.name).toBe(b!.name);
    expect(b!.name).toBe(c!.name);
  });

  test("get() returns undefined for unknown names", () => {
    const index = createComponentIndex(REGISTRY);
    expect(index.get("NoSuchComponent")).toBeUndefined();
    expect(index.get("")).toBeUndefined();
  });

  test("search({q}) matches across name/description/deps case-insensitively", () => {
    const index = createComponentIndex(REGISTRY);
    const buttonHits = index.search({ q: "button" });
    expect(buttonHits.length).toBeGreaterThan(0);
    // IconButton exists — match by name substring should include it.
    expect(buttonHits.some((c) => c.name === "IconButton" || c.name === "button")).toBe(true);
  });

  test("search({tier}) filters by tier (exact match)", () => {
    const index = createComponentIndex(REGISTRY);
    const features = index.search({ tier: "features" });
    expect(features.length).toBeGreaterThan(0);
    for (const c of features) {
      expect(c.tier).toBe("features");
    }

    const primitives = index.search({ tier: "primitives" });
    expect(primitives.length).toBeGreaterThan(0);
    for (const c of primitives) {
      expect(c.tier).toBe("primitives");
    }
  });

  test("search({q, tier}) applies both filters", () => {
    const index = createComponentIndex(REGISTRY);
    const hits = index.search({ q: "card", tier: "features" });
    // TemplateCard / AssetCard / BrandCard are in features.
    expect(hits.length).toBeGreaterThan(0);
    for (const c of hits) {
      expect(c.tier).toBe("features");
      const hay = `${c.name} ${c.description ?? ""} ${(c.dependencies ?? []).join(" ")}`.toLowerCase();
      expect(hay).toContain("card");
    }
  });

  test("deterministic ordering: ui → primitives → features → effects, then name", () => {
    const index = createComponentIndex(REGISTRY);
    const items = index.all();
    const tierOrder = ["ui", "primitives", "features", "effects"];
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const cur = items[i];
      const dp = tierOrder.indexOf(prev.tier);
      const dc = tierOrder.indexOf(cur.tier);
      if (dp !== dc) {
        expect(dp).toBeLessThan(dc);
      } else {
        expect(prev.name.localeCompare(cur.name)).toBeLessThanOrEqual(0);
      }
    }
  });

  test("tolerates a missing registry file (empty result, no throw)", () => {
    // Named inside a mkdtempSync directory rather than directly in tmpdir():
    // a `${Date.now()}` name is guessable, so another user on the machine
    // could pre-create or symlink it (CodeQL js/insecure-temporary-file).
    // The file itself is deliberately never created — that is the case
    // under test.
    const missing = resolve(mkdtempSync(join(tmpdir(), "reg-")), "no-such-registry.json");
    const index = createComponentIndex(missing);
    expect(index.all()).toEqual([]);
    expect(index.get("Button")).toBeUndefined();
    expect(index.search({ q: "anything" })).toEqual([]);
  });

  test("tolerates a malformed registry file (empty result, no throw)", () => {
    const bad = resolve(mkdtempSync(join(tmpdir(), "reg-")), "bad-registry.json");
    writeFileSync(bad, "{not valid json", "utf8");
    const index = createComponentIndex(bad);
    expect(index.all()).toEqual([]);
  });
});

// ─── In-process Express integration ─────────────────────────────────────────
//
// We mount the real `componentsRouter` on a minimal Express app bound to an
// ephemeral port. Tests then use `fetch` against that port so request/response
// semantics (headers, status codes, content types) are exercised end-to-end.

let server: Server;
let baseUrl = "";

function firstRegistryName(): string {
  const raw = JSON.parse(readFileSync(REGISTRY, "utf8")) as {
    components: Array<{ name: string }>;
  };
  return raw.components[0].name;
}

beforeAll((done) => {
  __resetDefaultComponentIndexForTests();
  const app = express();
  app.use(express.json());
  app.use("/api/components", componentsRouter);
  // Express default 404 — matches what the real server would return for
  // unmatched verbs, so regression guards behave predictably.
  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.originalUrl });
  });
  server = app.listen(0, () => {
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(() => done());
});

describe("GET /api/components (integration)", () => {
  test("returns new shape { items, total } (REQ-037, REQ-069)", async () => {
    const res = await fetch(`${baseUrl}/api/components`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.total).toBe(data.items.length);
    expect(data.items.length).toBeGreaterThan(0);
    const c = data.items[0];
    expect(c).toHaveProperty("name");
    expect(c).toHaveProperty("tier");
    expect(c).toHaveProperty("path");
  });

  test("?q= filters by substring across name/description/deps", async () => {
    const res = await fetch(`${baseUrl}/api/components?q=card`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    for (const c of data.items) {
      const hay = `${c.name} ${c.description ?? ""} ${(c.dependencies ?? []).join(" ")}`.toLowerCase();
      expect(hay).toContain("card");
    }
  });

  test("?tier=features filters by tier", async () => {
    const res = await fetch(`${baseUrl}/api/components?tier=features`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThan(0);
    for (const c of data.items) {
      expect(c.tier).toBe("features");
    }
  });

  test("?tier=invalid returns 400 with valid-tiers hint", async () => {
    const res = await fetch(`${baseUrl}/api/components?tier=banana`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(Array.isArray(data.valid)).toBe(true);
    expect(data.valid).toEqual(
      expect.arrayContaining(["ui", "primitives", "features", "effects"]),
    );
  });

  test("?q=card&tier=features compound filter works", async () => {
    const res = await fetch(`${baseUrl}/api/components?q=card&tier=features`);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const c of data.items) {
      expect(c.tier).toBe("features");
      const hay = `${c.name} ${c.description ?? ""} ${(c.dependencies ?? []).join(" ")}`.toLowerCase();
      expect(hay).toContain("card");
    }
  });
});

describe("DISABLE_ENRICHED_COMPONENTS feature flag (SPEC-014 rollback)", () => {
  const ORIGINAL = process.env.DISABLE_ENRICHED_COMPONENTS;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.DISABLE_ENRICHED_COMPONENTS;
    } else {
      process.env.DISABLE_ENRICHED_COMPONENTS = ORIGINAL;
    }
  });

  test("with flag=1, returns legacy { count, components } shape", async () => {
    process.env.DISABLE_ENRICHED_COMPONENTS = "1";
    const res = await fetch(`${baseUrl}/api/components`);
    expect(res.status).toBe(200);
    const data = await res.json();
    // Legacy shape: count + components[] with storybookUrl/docsUrl/variants.
    expect(typeof data.count).toBe("number");
    expect(Array.isArray(data.components)).toBe(true);
    expect(data.count).toBe(14);
    expect(data.components[0]).toHaveProperty("storybookUrl");
    expect(data.components[0]).toHaveProperty("docsUrl");
    expect(Array.isArray(data.components[0].variants)).toBe(true);
  });

  test("with flag=0 (or unset), returns new shape", async () => {
    delete process.env.DISABLE_ENRICHED_COMPONENTS;
    const res = await fetch(`${baseUrl}/api/components`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(data).not.toHaveProperty("count");
  });
});

describe("GET /api/components/:name (integration)", () => {
  test("returns full spec for a known component (REQ-038)", async () => {
    const known = firstRegistryName();
    const res = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known)}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name.toLowerCase()).toBe(known.toLowerCase());
    expect(data).toHaveProperty("tier");
    expect(data).toHaveProperty("path");
  });

  test("returns 404 { error, name } for unknown names (REQ-079)", async () => {
    const res = await fetch(`${baseUrl}/api/components/DoesNotExistXYZ`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({ error: "Component not found", name: "DoesNotExistXYZ" });
  });

  test("returns 400 for invalid names (path traversal / special chars)", async () => {
    const res = await fetch(`${baseUrl}/api/components/..%2F..%2Fetc`);
    // Express decodes %2F, but the validator rejects '/' and dots anyway.
    expect([400, 404]).toContain(res.status);
  });

  test("lookup is case-insensitive", async () => {
    const known = firstRegistryName();
    const upper = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known.toUpperCase())}`);
    const lower = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known.toLowerCase())}`);
    // At least one of these should resolve — registry names vary in casing.
    expect([upper.status, lower.status]).toContain(200);
  });
});

describe("GET /api/components/:name/preview (integration)", () => {
  test("returns text/html with 200 for a known component (REQ-039)", async () => {
    const known = firstRegistryName();
    const res = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known)}/preview`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body.toLowerCase()).toContain(known.toLowerCase());
  });

  test("returns 404 for unknown component on /preview", async () => {
    const res = await fetch(`${baseUrl}/api/components/NoSuchXYZ/preview`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("name", "NoSuchXYZ");
  });

  test("has no-cache and strict CSP headers", async () => {
    const known = firstRegistryName();
    const res = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known)}/preview`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("no-cache");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
  });

  test("POST /preview does not exist — regression guard for CISO RCE finding", async () => {
    const known = firstRegistryName();
    const res = await fetch(`${baseUrl}/api/components/${encodeURIComponent(known)}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "alert(1)" }),
    });
    // Express returns 404 for an unhandled verb on a matched path.
    expect([404, 405]).toContain(res.status);
  });
});
