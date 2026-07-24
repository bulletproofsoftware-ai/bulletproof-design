/**
 * Integration tests for /api/icons routes.
 *
 * Spins up an in-process Express app with only the icons router mounted,
 * backed by a fixture icon library. Exercises SPEC-003 route behavior
 * (REQ-040/041/042/043) and the normalized 404 shape (REQ-079).
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";
import { AddressInfo } from "net";
import express from "express";
import iconsRouter from "../src/api/routes/icons";
import { loadIconIndex, setIconIndex } from "../src/api/lib/iconIndex";

let TMP_DIR: string;
let server: http.Server;
let baseUrl: string;

const FIXTURE = {
  version: "1.0.0",
  source: "google/material-design-icons" as const,
  generated: "2026-04-17T00:00:00.000Z",
  icons: [
    {
      name: "home",
      category: "action",
      tags: ["action", "home"],
      aliases: ["house", "home"],
      styles: ["outlined", "rounded", "sharp"],
    },
    {
      name: "settings",
      category: "action",
      tags: ["action", "gear", "settings"],
      aliases: ["gear", "settings"],
      styles: ["outlined"],
    },
    {
      name: "person",
      category: "social",
      tags: ["social", "person"],
      aliases: ["user", "account", "person"],
      styles: ["outlined", "rounded"],
    },
  ],
};

const OUTLINED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z"/></svg>`;
const ROUNDED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;
const SHARP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20"/></svg>`;

beforeAll(async () => {
  TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "icons-api-test-"));
  fs.mkdirSync(path.join(TMP_DIR, "outlined"), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, "rounded"), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, "sharp"), { recursive: true });

  // Write SVG fixtures. `home` has all three; `settings` only outlined;
  // `person` outlined + rounded.
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "home.svg"), OUTLINED_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "rounded", "home.svg"), ROUNDED_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "sharp", "home.svg"), SHARP_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "settings.svg"), OUTLINED_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "outlined", "person.svg"), OUTLINED_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "rounded", "person.svg"), ROUNDED_SVG);
  fs.writeFileSync(path.join(TMP_DIR, "metadata.json"), JSON.stringify(FIXTURE));

  await loadIconIndex(TMP_DIR);

  const app = express();
  app.use("/api/icons", iconsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  setIconIndex(null);
  if (TMP_DIR) fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("GET /api/icons (list)", () => {
  test("returns paginated list with default limit", async () => {
    const res = await fetch(`${baseUrl}/api/icons`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.total).toBe(3);
    expect(data.page).toBe(1);
    expect(data.limit).toBeGreaterThan(0);
  });

  test("filters by q=home and style=outlined", async () => {
    const res = await fetch(`${baseUrl}/api/icons?q=home&style=outlined`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].name).toBe("home");
  });

  test("filters by style=rounded excludes icons without rounded", async () => {
    const res = await fetch(`${baseUrl}/api/icons?style=rounded`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const names = data.items.map((i: { name: string }) => i.name).sort();
    expect(names).toEqual(["home", "person"]);
  });

  test("filters by category", async () => {
    const res = await fetch(`${baseUrl}/api/icons?category=social`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].name).toBe("person");
  });

  test("limit=0 sentinel returns full filtered set", async () => {
    const res = await fetch(`${baseUrl}/api/icons?limit=0`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(3);
    expect(data.items.length).toBe(3);
    expect(data.page).toBe(1);
  });

  test("invalid style returns 400 with allowed list", async () => {
    const res = await fetch(`${baseUrl}/api/icons?style=filled`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("style");
    expect(Array.isArray(data.allowed)).toBe(true);
  });

  test("invalid page returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/icons?page=abc`);
    expect(res.status).toBe(400);
  });

  test("invalid limit returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/icons?limit=-1`);
    expect(res.status).toBe(400);
  });

  test("rejects NUL byte in q", async () => {
    const res = await fetch(`${baseUrl}/api/icons?q=home%00hack`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/icons/categories", () => {
  test("returns categories with counts", async () => {
    const res = await fetch(`${baseUrl}/api/icons/categories`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("categories");
    expect(Array.isArray(data.categories)).toBe(true);
    const map = Object.fromEntries(
      data.categories.map((c: { category: string; count: number }) => [c.category, c.count]),
    );
    expect(map.action).toBe(2);
    expect(map.social).toBe(1);
  });
});

describe("GET /api/icons/:name", () => {
  test("returns metadata plus availableStyles", async () => {
    const res = await fetch(`${baseUrl}/api/icons/home`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("home");
    expect(data.category).toBe("action");
    expect(Array.isArray(data.availableStyles)).toBe(true);
    expect(data.availableStyles.sort()).toEqual(["outlined", "rounded", "sharp"]);
  });

  test("returns 404 with {error, name} for unknown name", async () => {
    const res = await fetch(`${baseUrl}/api/icons/does_not_exist`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Icon not found");
    expect(data.name).toBe("does_not_exist");
  });

  test("returns 400 for invalid name characters", async () => {
    const res = await fetch(`${baseUrl}/api/icons/Home`);
    // uppercase rejected by name pattern
    expect(res.status).toBe(400);
  });
});

describe("GET /api/icons/:name/svg", () => {
  test("returns SVG with image/svg+xml content-type and immutable cache", async () => {
    const res = await fetch(`${baseUrl}/api/icons/home/svg`);
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type");
    expect(ct).toContain("image/svg+xml");
    const cc = res.headers.get("cache-control");
    expect(cc).toContain("max-age=86400");
    expect(cc).toContain("immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await res.text();
    expect(body).toContain("<svg");
  });

  test("style=rounded returns the rounded variant body", async () => {
    const res = await fetch(`${baseUrl}/api/icons/home/svg?style=rounded`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<circle"); // rounded fixture is a circle
  });

  test("style=sharp returns the sharp variant body", async () => {
    const res = await fetch(`${baseUrl}/api/icons/home/svg?style=sharp`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<rect"); // sharp fixture is a rect
  });

  test("invalid style returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/icons/home/svg?style=filled`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("style");
  });

  test("unknown name returns 404 {error, name}", async () => {
    const res = await fetch(`${baseUrl}/api/icons/totally_fake/svg`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Icon not found");
    expect(data.name).toBe("totally_fake");
  });

  test("style not available for icon returns 404 {error, name, style}", async () => {
    const res = await fetch(`${baseUrl}/api/icons/settings/svg?style=sharp`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Style not available");
    expect(data.name).toBe("settings");
    expect(data.style).toBe("sharp");
  });

  test("path traversal in :name is rejected (400)", async () => {
    const res = await fetch(`${baseUrl}/api/icons/..%2Fetc/svg`);
    // Express decodes %2F into / which makes it a different route; either 400 or 404 is acceptable.
    expect([400, 404]).toContain(res.status);
  });

  test("direct traversal like ../etc returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/icons/..etc/svg`);
    expect([400, 404]).toContain(res.status);
  });

  test("refuses to serve an SVG containing a script tag", async () => {
    const dangerousName = "dangerous";
    // Inject a malicious file on disk + register it in the in-memory index,
    // then verify the route rejects it rather than relaying the content.
    fs.writeFileSync(
      path.join(TMP_DIR, "outlined", `${dangerousName}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
    );
    const nextFixture = {
      ...FIXTURE,
      icons: [
        ...FIXTURE.icons,
        {
          name: dangerousName,
          category: "action",
          tags: ["action"],
          aliases: ["danger"],
          styles: ["outlined"],
        },
      ],
    };
    fs.writeFileSync(path.join(TMP_DIR, "metadata.json"), JSON.stringify(nextFixture));
    await loadIconIndex(TMP_DIR);

    const res = await fetch(`${baseUrl}/api/icons/${dangerousName}/svg`);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("safety");

    // Restore baseline fixture for remaining tests (if any).
    fs.writeFileSync(path.join(TMP_DIR, "metadata.json"), JSON.stringify(FIXTURE));
    fs.unlinkSync(path.join(TMP_DIR, "outlined", `${dangerousName}.svg`));
    await loadIconIndex(TMP_DIR);
  });
});
