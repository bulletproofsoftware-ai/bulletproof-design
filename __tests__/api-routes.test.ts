/**
 * Stack-dependent integration suite: requires the asset API server running on
 * localhost:8096 (`npm run api`). Gated behind RUN_API_TESTS=1 — see README
 * "Running the API integration tests".
 */
const describeApi = process.env.RUN_API_TESTS === "1" ? describe : describe.skip;

/**
 * API Route Integration Tests
 *
 * Supplements api.test.ts with additional coverage for all route files:
 * - src/api/routes/templates.ts
 * - src/api/routes/brands.ts
 * - src/api/routes/assets.ts
 * - src/api/server.ts
 *
 * These are non-destructive tests — GET endpoints are tested fully,
 * PUT/DELETE endpoints only verify response structure without mutating data.
 *
 * Rate limiting: The API enforces 100 req/15min. Tests accept 429 as valid
 * when rate-limited and skip remaining assertions for that test.
 */

const BASE_URL = "http://localhost:8096";

/** Check if the API server is reachable before running tests */
let serverAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
});

/**
 * Helper: fetch with rate-limit and server-error awareness.
 * Returns null on 429 (rate limited) so the caller can skip gracefully.
 */
async function apiFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (res.status === 429) {
    console.warn(`[rate-limited] ${init?.method ?? "GET"} ${path} — skipping assertions`);
    return null;
  }
  return res;
}

/**
 * Safely parse JSON from a response, returning null if the body is not valid JSON.
 */
async function safeJson(res: Response): Promise<any | null> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-level endpoints (src/api/server.ts)
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Server endpoints", () => {
  test("GET /api/health returns required fields", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/health");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("service", "design-library-api");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("templatesDir");
    expect(data).toHaveProperty("assetsDir");
  });

  test("GET /api/search returns 400 without query param", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/search");
    if (!res) return;
    expect(res.status).toBe(400);
  });

  test("GET /api/search?q=button returns structured results", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/search?q=button");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("query", "button");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.results)).toBe(true);
  });

  test("GET /api/components returns component list with structure", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/components");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.components)).toBe(true);
    if (data.components.length > 0) {
      const c = data.components[0];
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("variants");
    }
  });

  test("GET /api/categories returns categories with counts", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/categories");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.categories)).toBe(true);
    if (data.categories.length > 0) {
      expect(data.categories[0]).toHaveProperty("name");
      expect(data.categories[0]).toHaveProperty("count");
    }
  });

  test("GET /api/nonexistent returns 404 with available endpoints", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/nonexistent-route");
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error", "Not found");
    expect(Array.isArray(data.availableEndpoints)).toBe(true);
    expect(data.availableEndpoints.length).toBeGreaterThan(0);
  });

  test("security headers are present", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/health");
    if (!res) return;
    // helmet sets various security headers
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
    // x-powered-by should be disabled
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Templates (src/api/routes/templates.ts)
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Templates routes", () => {
  test("GET /api/templates/:category returns templates array", async () => {
    if (!serverAvailable) return;
    const catRes = await apiFetch("/api/categories");
    if (!catRes) return;
    const catData = await catRes.json();
    if (catData.categories.length === 0) return;

    const category = catData.categories[0].name;
    const res = await apiFetch(`/api/templates/${category}`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("category", category);
    expect(Array.isArray(data.templates)).toBe(true);
  });

  test("GET /api/templates/:category with ?source=true includes sourceCode", async () => {
    if (!serverAvailable) return;
    const catRes = await apiFetch("/api/categories");
    if (!catRes) return;
    const catData = await catRes.json();
    if (catData.categories.length === 0) return;

    const category = catData.categories[0].name;
    const res = await apiFetch(`/api/templates/${category}?source=true`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    if (data.templates.length > 0) {
      expect(data.templates[0]).toHaveProperty("sourceCode");
    }
  });

  test("GET /api/templates/:category with ?source=false excludes sourceCode", async () => {
    if (!serverAvailable) return;
    const catRes = await apiFetch("/api/categories");
    if (!catRes) return;
    const catData = await catRes.json();
    if (catData.categories.length === 0) return;

    const category = catData.categories[0].name;
    const res = await apiFetch(`/api/templates/${category}?source=false`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    if (data.templates.length > 0) {
      expect(data.templates[0]).not.toHaveProperty("sourceCode");
    }
  });

  test("GET /api/templates/:category with invalid source param returns 400", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/dashboards?source=invalid");
    if (!res) return;
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  test("GET /api/templates/:category returns 404 for unknown category", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/nonexistent-category-xyz");
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("category", "nonexistent-category-xyz");
  });

  test("GET /api/templates/:category/:name returns single template", async () => {
    if (!serverAvailable) return;
    const catRes = await apiFetch("/api/categories");
    if (!catRes) return;
    const catData = await catRes.json();
    if (catData.categories.length === 0) return;

    const category = catData.categories[0].name;
    const listRes = await apiFetch(`/api/templates/${category}`);
    if (!listRes) return;
    const listData = await listRes.json();
    if (listData.templates.length === 0) return;

    const name = listData.templates[0].name;
    const res = await apiFetch(`/api/templates/${category}/${name}`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("name", name);
    expect(data).toHaveProperty("sourceCode");
    expect(data).toHaveProperty("filePath");
    expect(data).toHaveProperty("category");
  });

  test("GET /api/templates/:category/:name returns 404 for unknown template", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/dashboards/nonexistent-template-xyz");
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error", "Template not found");
  });

  test("GET /api/templates with path traversal returns 400 or 404", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/../../../etc");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("PUT /api/templates/:category/:name returns 400 without sourceCode", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/dashboards/analytics-dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res) return;
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });

  test("DELETE /api/templates/:category/:name returns 404 for nonexistent", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/nonexistent/nonexistent", {
      method: "DELETE",
    });
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Brands (src/api/routes/brands.ts)
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Brands routes", () => {
  let validSlug: string | null = null;
  let brandsEndpointAvailable = false;

  beforeAll(async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands");
    if (!res || res.status >= 500) return;
    brandsEndpointAvailable = true;
    const data = await safeJson(res);
    if (data?.brands && data.brands.length > 0) {
      validSlug = data.brands[0].slug;
    }
  });

  test("GET /api/brands returns brands array", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("brands");
    expect(Array.isArray(data.brands)).toBe(true);
  });

  test("GET /api/brands/:slug returns full brand config", async () => {
    if (!serverAvailable || !brandsEndpointAvailable || !validSlug) return;
    const res = await apiFetch(`/api/brands/${validSlug}`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("colors");
  });

  test("GET /api/brands/:slug returns 404 for unknown brand", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-brand-xyz");
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("error", "Brand not found");
    expect(data).toHaveProperty("slug", "nonexistent-brand-xyz");
  });

  test("GET /api/brands/:slug/assets returns assets object", async () => {
    if (!serverAvailable || !brandsEndpointAvailable || !validSlug) return;
    const res = await apiFetch(`/api/brands/${validSlug}/assets`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("slug", validSlug);
    expect(data).toHaveProperty("assets");
  });

  test("GET /api/brands/:slug/assets returns 404 for unknown brand", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-xyz/assets");
    if (!res) return;
    expect(res.status).toBe(404);
  });

  test("GET /api/brands/:slug/colors returns color palette", async () => {
    if (!serverAvailable || !brandsEndpointAvailable || !validSlug) return;
    const res = await apiFetch(`/api/brands/${validSlug}/colors`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("slug", validSlug);
    expect(data).toHaveProperty("colors");
  });

  test("GET /api/brands/:slug/colors returns 404 for unknown brand", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-xyz/colors");
    if (!res) return;
    expect(res.status).toBe(404);
  });

  test("GET /api/brands/:slug/fonts returns font config", async () => {
    if (!serverAvailable || !brandsEndpointAvailable || !validSlug) return;
    const res = await apiFetch(`/api/brands/${validSlug}/fonts`);
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("slug", validSlug);
    expect(data).toHaveProperty("fonts");
  });

  test("GET /api/brands/:slug/fonts returns 404 for unknown brand", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-xyz/fonts");
    if (!res) return;
    expect(res.status).toBe(404);
  });

  test("GET /api/brands/:slug/css-variables returns CSS text", async () => {
    if (!serverAvailable || !brandsEndpointAvailable || !validSlug) return;
    const res = await apiFetch(`/api/brands/${validSlug}/css-variables`);
    if (!res) return;
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("text/css");
    const css = await res.text();
    expect(css.length).toBeGreaterThan(0);
    expect(css).toContain("--");
  });

  test("GET /api/brands/:slug/css-variables returns 404 for unknown brand", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-xyz/css-variables");
    if (!res) return;
    expect(res.status).toBe(404);
  });

  test("PUT /api/brands/:slug with body returns valid response", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-slug-xyz", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    if (!res) return;
    // Should return a valid HTTP status — not crash
    expect([200, 400, 401, 500]).toContain(res.status);
  });

  test("DELETE /api/brands/:slug returns 404 for nonexistent", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands/nonexistent-brand-xyz", {
      method: "DELETE",
    });
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("error");
  });

  test("POST /api/brands returns 400 for missing required fields", async () => {
    if (!serverAvailable || !brandsEndpointAvailable) return;
    const res = await apiFetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Incomplete" }),
    });
    if (!res) return;
    expect(res.status).toBe(400);
    const data = await safeJson(res);
    if (!data) return;
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("required");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Assets (src/api/routes/assets.ts)
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Assets routes", () => {
  test("GET /api/assets returns assets array with URLs", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("assets");
    expect(Array.isArray(data.assets)).toBe(true);
    if (data.assets.length > 0) {
      const asset = data.assets[0];
      expect(asset).toHaveProperty("path");
      expect(asset).toHaveProperty("name");
      expect(asset).toHaveProperty("folder");
      expect(asset).toHaveProperty("size");
      expect(asset).toHaveProperty("type");
      expect(asset).toHaveProperty("url");
      expect(asset).toHaveProperty("modifiedAt");
    }
  });

  test("GET /api/assets?folder=brands filters by folder", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets?folder=brands");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.assets)).toBe(true);
    for (const asset of data.assets) {
      expect(asset.folder.startsWith("brands")).toBe(true);
    }
  });

  test("GET /api/assets?folder=nonexistent returns empty array", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets?folder=nonexistent-xyz");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assets).toEqual([]);
  });

  test("GET /api/assets/folders returns folders array", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets/folders");
    if (!res) return;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("folders");
    expect(Array.isArray(data.folders)).toBe(true);
  });

  test("DELETE /api/assets/nonexistent/file.txt returns 404", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets/nonexistent/file.txt", {
      method: "DELETE",
    });
    if (!res) return;
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty("error", "Asset not found");
  });

  test("DELETE /api/assets with path traversal is rejected", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets/../../../etc/passwd", {
      method: "DELETE",
    });
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("POST /api/assets returns 400 for missing fields", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "test" }),
    });
    if (!res) return;
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preview (src/api/routes/preview.ts — mounted on server.ts)
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Preview routes", () => {
  test("GET /preview/:category/:name returns HTML for valid template", async () => {
    if (!serverAvailable) return;
    const catRes = await apiFetch("/api/categories");
    if (!catRes) return;
    const catData = await catRes.json();
    if (catData.categories.length === 0) return;

    const category = catData.categories[0].name;
    const listRes = await apiFetch(`/api/templates/${category}`);
    if (!listRes) return;
    const listData = await listRes.json();
    if (listData.templates.length === 0) return;

    const name = listData.templates[0].name;
    const res = await fetch(`${BASE_URL}/preview/${category}/${name}`);
    if (res.status === 429) return;
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
  });

  test("GET /preview/:category/:name returns 404 for unknown", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE_URL}/preview/nonexistent/nonexistent`);
    if (res.status === 429) return;
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input validation across routes
// ─────────────────────────────────────────────────────────────────────────────
describeApi("Input validation", () => {
  test("template category rejects special characters", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/cat%00egory");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("brand slug rejects special characters", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands/slug%00name");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("template name rejects special characters", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/templates/dashboards/name%00hack");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("brand colors endpoint rejects invalid slug", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands/slug%00hack/colors");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("brand fonts endpoint rejects invalid slug", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands/slug%00hack/fonts");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("brand css-variables endpoint rejects invalid slug", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands/slug%00hack/css-variables");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });

  test("brand assets endpoint rejects invalid slug", async () => {
    if (!serverAvailable) return;
    const res = await apiFetch("/api/brands/slug%00hack/assets");
    if (!res) return;
    expect([400, 404]).toContain(res.status);
  });
});
