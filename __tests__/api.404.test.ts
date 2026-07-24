/**
 * SPEC-013 REQ-072 + REQ-079 — Normalized 404 shape coverage.
 *
 * Every expansion-era endpoint that takes a `:slug` or `:name` path param
 * must return a REQ-079 normalized 404 envelope — `{error, slug}` or
 * `{error, name}` — when the target does not exist. This file exercises
 * them all against an ephemeral in-process server with a known-empty
 * brand index and empty icon index. No existing fixture paths are
 * referenced, guaranteeing every lookup misses.
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
import iconsRouter from "../src/api/routes/icons";
import componentsRouter from "../src/api/routes/components";
import { buildBrandIndex, closeWatcher } from "../src/api/lib/brandIndex";
import {
  loadIconIndex,
  setIconIndex,
} from "../src/api/lib/iconIndex";
import { __resetDefaultComponentIndexForTests } from "../src/api/lib/componentIndex";

const TMP_BRANDS = path.join(os.tmpdir(), "design-lib-404-brands-" + Date.now());
const TMP_ICONS = path.join(os.tmpdir(), "design-lib-404-icons-" + Date.now());
const TMP_REGISTRY = path.join(os.tmpdir(), "design-lib-404-registry-" + Date.now() + ".json");

let server: Server | null = null;
let baseUrl = "";

// Empty icon metadata — so every lookup returns "icon not found".
const EMPTY_ICONS_META = {
  version: "1.0.0",
  source: "google/material-design-icons" as const,
  generated: "2026-04-18T00:00:00.000Z",
  icons: [] as Array<{
    name: string;
    category: string;
    tags: string[];
    aliases: string[];
    styles: Array<"outlined" | "rounded" | "sharp">;
  }>,
};

beforeAll(async () => {
  // Empty brands dir — just create it so the index builds cleanly.
  await fsp.mkdir(TMP_BRANDS, { recursive: true });

  // Icons dir with an empty metadata.json so the loader succeeds but every
  // lookup misses.
  await fsp.mkdir(TMP_ICONS, { recursive: true });
  await fsp.writeFile(
    path.join(TMP_ICONS, "metadata.json"),
    JSON.stringify(EMPTY_ICONS_META),
  );
  // Empty component registry — every get() misses.
  await fsp.writeFile(
    TMP_REGISTRY,
    JSON.stringify({ components: [] }, null, 2),
  );

  process.env.BRANDS_DIR = TMP_BRANDS;
  process.env.REGISTRY_PATH = TMP_REGISTRY;

  buildBrandIndex(TMP_BRANDS);
  await loadIconIndex(TMP_ICONS);
  __resetDefaultComponentIndexForTests();

  const app = express();
  app.use(express.json());
  // Mount the factory explicitly so it reads from our empty registry.
  // components router lazily resolves the default index — we need to make
  // that index point at our empty file. We create a shim by importing the
  // factory and replacing the default singleton via __resetDefault* first,
  // then setting REGISTRY_PATH. The constructor reads from the cwd default,
  // so instead we instantiate explicitly.
  app.use("/api/brands", brandsRouter);
  app.use("/brand-assets", brandAssetsStaticRouter);
  app.use("/api/icons", iconsRouter);
  app.use("/api/components", componentsRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  closeWatcher();
  setIconIndex(null);
  __resetDefaultComponentIndexForTests();
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  try {
    fs.rmSync(TMP_BRANDS, { recursive: true, force: true });
  } catch {
    // best-effort
  }
  try {
    fs.rmSync(TMP_ICONS, { recursive: true, force: true });
  } catch {
    // best-effort
  }
  try {
    fs.rmSync(TMP_REGISTRY, { force: true });
  } catch {
    // best-effort
  }
});

async function get(urlPath: string): Promise<Response> {
  return fetch(`${baseUrl}${urlPath}`);
}

async function expectBrandSlug404(urlPath: string, slug: string): Promise<void> {
  const res = await get(urlPath);
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body).toHaveProperty("error");
  expect(typeof body.error).toBe("string");
  expect(body.error.length).toBeGreaterThan(0);
  expect(body.slug).toBe(slug);
}

async function expectIconName404(urlPath: string, name: string): Promise<void> {
  const res = await get(urlPath);
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBeTruthy();
  expect(body.name).toBe(name);
}

async function expectComponentName404(
  urlPath: string,
  name: string,
): Promise<void> {
  const res = await get(urlPath);
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBeTruthy();
  expect(body.name).toBe(name);
}

// ────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────

describe("REQ-079 normalized 404 shape — brand endpoints", () => {
  const MISSING = "no-such-brand-xyz";

  test.each([
    "/api/brands/" + MISSING,
    "/api/brands/" + MISSING + "/colors",
    "/api/brands/" + MISSING + "/fonts",
    "/api/brands/" + MISSING + "/assets",
    "/api/brands/" + MISSING + "/css-variables",
    "/api/brands/" + MISSING + "/identity",
    "/api/brands/" + MISSING + "/logos",
    "/api/brands/" + MISSING + "/typography",
    "/api/brands/" + MISSING + "/guidelines",
  ])("GET %s → 404 { error, slug }", async (urlPath) => {
    // css-variables endpoint streams text/css for 200 but its 404 uses JSON.
    await expectBrandSlug404(urlPath, MISSING);
  });

  test("GET /brand-assets/:slug/:file → 404 { error, slug, file } when file missing", async () => {
    const res = await get("/brand-assets/" + MISSING + "/nothing.svg");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    // This endpoint additionally includes `slug` and `file` when available.
    // Accept either shape — the minimum contract is `error` string + some
    // identifying context (`slug` in this case).
    expect(body.slug).toBe(MISSING);
  });
});

describe("REQ-079 normalized 404 shape — icon endpoints", () => {
  const MISSING = "missing_icon";

  test("GET /api/icons/:name missing → 404 { error, name }", async () => {
    await expectIconName404("/api/icons/" + MISSING, MISSING);
  });

  test("GET /api/icons/:name/svg missing name → 404 { error, name }", async () => {
    await expectIconName404("/api/icons/" + MISSING + "/svg", MISSING);
  });
});

describe("REQ-079 normalized 404 shape — component endpoints", () => {
  const MISSING = "MissingComponent";

  test("GET /api/components/:name missing → 404 { error, name }", async () => {
    await expectComponentName404("/api/components/" + MISSING, MISSING);
  });

  test("GET /api/components/:name/preview missing → 404 { error, name }", async () => {
    await expectComponentName404(
      "/api/components/" + MISSING + "/preview",
      MISSING,
    );
  });
});

describe("REQ-079 — 404 envelopes are JSON and include no stack traces", () => {
  test("brand 404 Content-Type is application/json", async () => {
    const res = await get("/api/brands/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
  });

  test("icon 404 body does not leak stack traces or file paths", async () => {
    const res = await get("/api/icons/nope");
    const body = await res.json();
    const keys = Object.keys(body);
    expect(keys).not.toContain("stack");
    expect(JSON.stringify(body)).not.toMatch(/\/Users\/|\\Users\\/);
  });

  test("component 404 body does not leak stack traces", async () => {
    const res = await get("/api/components/Nothing");
    const body = await res.json();
    expect(body).not.toHaveProperty("stack");
  });
});
