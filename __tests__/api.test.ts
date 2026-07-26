/**
 * Stack-dependent integration suite: requires the asset API server running on
 * localhost:8096 (`npm run api`). Gated behind RUN_API_TESTS=1 — see README
 * "Running the API integration tests".
 */
// `export {}` makes this file a module. Without it TypeScript treats it as a
// global script, and the identical `describeApi` in the sibling suite collides
// (TS2451: Cannot redeclare block-scoped variable).
export {};

const describeApi = process.env.RUN_API_TESTS === "1" ? describe : describe.skip;

const API = "http://localhost:8096";

describeApi("Design Library API", () => {
  // ─── Health ────────────────────────────────────
  describe("GET /api/health", () => {
    test("returns ok status", async () => {
      const res = await fetch(`${API}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("design-library-api");
      expect(data.timestamp).toBeTruthy();
    });
  });

  // ─── Categories ────────────────────────────────
  describe("GET /api/categories", () => {
    test("returns array of categories", async () => {
      const res = await fetch(`${API}/api/categories`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);
      expect(data.categories[0]).toHaveProperty("name");
      expect(data.categories[0]).toHaveProperty("count");
    });
  });

  // ─── Templates ─────────────────────────────────
  describe("Templates CRUD", () => {
    const testCategory = "test-api";
    const testName = "jest-integration";

    test("GET /api/templates/:category returns templates", async () => {
      const res = await fetch(`${API}/api/templates/dashboards`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category).toBe("dashboards");
      expect(Array.isArray(data.templates)).toBe(true);
    });

    test("GET /api/templates/:category with ?source=true includes sourceCode", async () => {
      const res = await fetch(`${API}/api/templates/dashboards?source=true`);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.templates.length > 0) {
        expect(data.templates[0]).toHaveProperty("sourceCode");
      }
    });

    test("GET /api/templates/:category returns 404 for unknown category", async () => {
      const res = await fetch(`${API}/api/templates/nonexistent-category-xyz`);
      expect(res.status).toBe(404);
    });

    test("GET /api/templates/:category/:name returns single template", async () => {
      const res = await fetch(`${API}/api/templates/dashboards/analytics-dashboard`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("analytics-dashboard");
      expect(data.sourceCode).toBeTruthy();
    });

    test("GET /api/templates/:category/:name returns 404 for unknown", async () => {
      const res = await fetch(`${API}/api/templates/dashboards/nonexistent-xyz`);
      expect(res.status).toBe(404);
    });

    test("POST /api/templates creates template", async () => {
      const res = await fetch(`${API}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: testCategory,
          name: testName,
          description: "Integration test template",
          tags: ["test"],
          sourceCode: '/** @meta\n * category: test-api\n * name: jest-integration\n * description: test\n * tags: [test]\n * source: test\n */\nexport default function JestIntegration() { return null; }',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe("created");
    });

    test("POST /api/templates returns 400 for missing fields", async () => {
      const res = await fetch(`${API}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "test" }),
      });
      expect(res.status).toBe(400);
    });

    test("POST /api/templates returns 409 for duplicate", async () => {
      const res = await fetch(`${API}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: testCategory,
          name: testName,
          sourceCode: "duplicate",
        }),
      });
      expect(res.status).toBe(409);
    });

    test("PUT /api/templates/:category/:name updates template", async () => {
      const res = await fetch(`${API}/api/templates/${testCategory}/${testName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: '/** @meta\n * category: test-api\n * name: jest-integration\n * description: updated\n * tags: [test]\n * source: test\n */\nexport default function JestIntegration() { return "updated"; }',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("updated");
    });

    test("PUT /api/templates/:category/:name returns 400 without sourceCode", async () => {
      const res = await fetch(`${API}/api/templates/${testCategory}/${testName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    test("DELETE /api/templates/:category/:name deletes template", async () => {
      const res = await fetch(`${API}/api/templates/${testCategory}/${testName}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("deleted");
    });

    test("DELETE /api/templates/:category/:name returns 404 for nonexistent", async () => {
      const res = await fetch(`${API}/api/templates/nonexistent/nonexistent`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Components ────────────────────────────────
  describe("GET /api/components", () => {
    test("returns component manifest", async () => {
      const res = await fetch(`${API}/api/components`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.components)).toBe(true);
      expect(data.components[0]).toHaveProperty("name");
      expect(data.components[0]).toHaveProperty("variants");
    });
  });

  // ─── Search ────────────────────────────────────
  describe("GET /api/search", () => {
    test("returns results for valid query", async () => {
      const res = await fetch(`${API}/api/search?q=dashboard`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.query).toBe("dashboard");
      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.results)).toBe(true);
    });

    test("returns 400 for empty query", async () => {
      const res = await fetch(`${API}/api/search?q=`);
      expect(res.status).toBe(400);
    });

    test("returns empty results for nonsense query", async () => {
      const res = await fetch(`${API}/api/search?q=zzzznonexistentzzzz`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(0);
    });
  });

  // ─── Brands ────────────────────────────────────
  describe("Brands CRUD", () => {
    const testSlug = "jest-test-brand";

    test("GET /api/brands returns array", async () => {
      const res = await fetch(`${API}/api/brands`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.brands)).toBe(true);
    });

    test("GET /api/brands/:slug returns brand", async () => {
      const res = await fetch(`${API}/api/brands/bulletproof`);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("name");
        expect(data).toHaveProperty("colors");
      }
    });

    test("GET /api/brands/:slug returns 404 for unknown", async () => {
      const res = await fetch(`${API}/api/brands/nonexistent-brand-xyz`);
      expect(res.status).toBe(404);
    });

    test("GET /api/brands/:slug/colors returns colors", async () => {
      const res = await fetch(`${API}/api/brands/bulletproof`);
      if (res.status === 200) {
        const colorsRes = await fetch(`${API}/api/brands/bulletproof/colors`);
        expect(colorsRes.status).toBe(200);
        const data = await colorsRes.json();
        expect(data).toHaveProperty("colors");
      }
    });

    test("GET /api/brands/:slug/fonts returns fonts", async () => {
      const res = await fetch(`${API}/api/brands/bulletproof`);
      if (res.status === 200) {
        const fontsRes = await fetch(`${API}/api/brands/bulletproof/fonts`);
        expect(fontsRes.status).toBe(200);
        const data = await fontsRes.json();
        expect(data).toHaveProperty("fonts");
      }
    });

    test("GET /api/brands/:slug/css-variables returns CSS", async () => {
      const brandsRes = await fetch(`${API}/api/brands`);
      const brands = await brandsRes.json();
      if (brands.brands.length > 0) {
        const slug = brands.brands[0].slug;
        const res = await fetch(`${API}/api/brands/${slug}/css-variables`);
        expect(res.status).toBe(200);
      }
    });

    test("GET /api/brands/:slug/assets returns assets", async () => {
      const brandsRes = await fetch(`${API}/api/brands`);
      const brands = await brandsRes.json();
      if (brands.brands.length > 0) {
        const slug = brands.brands[0].slug;
        const res = await fetch(`${API}/api/brands/${slug}/assets`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty("assets");
      }
    });

    test("POST /api/brands creates brand", async () => {
      const res = await fetch(`${API}/api/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jest Test Brand",
          slug: testSlug,
          description: "Test brand",
          colors: { primary: "#3b82f6", secondary: "#64748b", accent: "#f59e0b", background: "#ffffff", surface: "#f8fafc", text: "#0f172a", textMuted: "#64748b", border: "#e2e8f0", error: "#ef4444", warning: "#f59e0b", success: "#22c55e" },
          fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe("created");
    });

    test("POST /api/brands returns 400 for missing fields", async () => {
      const res = await fetch(`${API}/api/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Incomplete" }),
      });
      expect(res.status).toBe(400);
    });

    test("POST /api/brands returns 409 for duplicate slug", async () => {
      const res = await fetch(`${API}/api/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate",
          slug: testSlug,
          colors: { primary: "#000" },
        }),
      });
      expect(res.status).toBe(409);
    });

    test("PUT /api/brands/:slug updates brand", async () => {
      const res = await fetch(`${API}/api/brands/${testSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jest Updated Brand",
          colors: { primary: "#ef4444" },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("updated");
    });

    test("DELETE /api/brands/:slug deletes brand", async () => {
      const res = await fetch(`${API}/api/brands/${testSlug}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("deleted");
    });

    test("DELETE /api/brands/:slug returns 404 for nonexistent", async () => {
      const res = await fetch(`${API}/api/brands/nonexistent-brand-xyz`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Import ────────────────────────────────────
  describe("POST /api/import", () => {
    test("generates template from URL", async () => {
      const res = await fetch(`${API}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          category: "test",
          name: "import-test",
        }),
      });
      const data = await res.json();
      expect(data.status).toBe("generated");
      expect(data.sourceCode).toBeTruthy();
    }, 30000);

    test("returns 400 for missing url", async () => {
      const res = await fetch(`${API}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "test", name: "test" }),
      });
      expect(res.status).toBe(400);
    });

    test("returns 400 for invalid url", async () => {
      const res = await fetch(`${API}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url", category: "test", name: "test" }),
      });
      expect(res.status).toBe(400);
    });

    test("returns 400 for missing category/name", async () => {
      const res = await fetch(`${API}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Assets ────────────────────────────────────
  describe("Assets", () => {
    test("GET /api/assets returns array", async () => {
      const res = await fetch(`${API}/api/assets`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.assets)).toBe(true);
    });

    test("GET /api/assets?folder=brands filters by folder", async () => {
      const res = await fetch(`${API}/api/assets?folder=brands`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.assets)).toBe(true);
    });

    test("GET /api/assets/folders returns folders", async () => {
      const res = await fetch(`${API}/api/assets/folders`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.folders)).toBe(true);
    });

    test("POST /api/assets uploads and DELETE removes", async () => {
      // Upload
      const uploadRes = await fetch(`${API}/api/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: "test",
          filename: "test-upload.txt",
          data: Buffer.from("test content").toString("base64"),
        }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadData = await uploadRes.json();
      expect(uploadData.path).toBe("test/test-upload.txt");

      // Delete
      const deleteRes = await fetch(`${API}/api/assets/test/test-upload.txt`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);
    });

    test("POST /api/assets returns 400 for missing fields", async () => {
      const res = await fetch(`${API}/api/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "test" }),
      });
      expect(res.status).toBe(400);
    });

    test("DELETE /api/assets returns 404 for nonexistent", async () => {
      const res = await fetch(`${API}/api/assets/nonexistent/file.txt`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Preview ───────────────────────────────────
  describe("Preview", () => {
    test("GET /preview/:category/:name returns HTML", async () => {
      const res = await fetch(`${API}/preview/dashboards/analytics-dashboard`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<!DOCTYPE html>");
    });

    test("GET /preview/:category/:name returns 404 for unknown", async () => {
      const res = await fetch(`${API}/preview/nonexistent/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  // ─── 404 Handler ───────────────────────────────
  describe("404 Handler", () => {
    test("GET /api/unknown returns 404 with endpoint list", async () => {
      const res = await fetch(`${API}/api/unknown-endpoint`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Not found");
      expect(Array.isArray(data.availableEndpoints)).toBe(true);
    });
  });

  // ─── Input Validation ─────────────────────────
  describe("Input Validation", () => {
    test("rejects path traversal in template category", async () => {
      const res = await fetch(`${API}/api/templates/../../../etc`);
      expect([400, 404]).toContain(res.status);
    });

    test("rejects path traversal in asset delete", async () => {
      const res = await fetch(`${API}/api/assets/../../../etc/passwd`, {
        method: "DELETE",
      });
      expect([400, 404]).toContain(res.status);
    });
  });
});
