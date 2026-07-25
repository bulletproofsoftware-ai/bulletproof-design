/**
 * SPEC-014 infrastructure invariants — static checks against Dockerfile
 * and middleware.ts. These are fast file-read tests; no server required.
 *
 * Covers:
 *   REQ-082 / REQ-091 (F-DOCKER-01) — Dockerfile runs as non-root.
 *   REQ-086 (F-CSP-01)              — production CSP has no 'unsafe-inline' on script-src.
 *   REQ-087 (F-SUPPLY-01)           — npm audit gate in Dockerfile and package.json script.
 *   REQ-055 / REQ-080               — docker-compose icons volume and feature flag env vars.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

describe("SPEC-014 / REQ-091 — Dockerfile runs as non-root", () => {
  const dockerfile = read("Dockerfile");

  test("contains a USER directive", () => {
    expect(dockerfile).toMatch(/^\s*USER\s+\S+/m);
  });

  test("USER is not root", () => {
    const match = dockerfile.match(/^\s*USER\s+(\S+)/m);
    expect(match).not.toBeNull();
    const user = match![1];
    expect(user).not.toBe("root");
    expect(user).not.toBe("0");
    expect(user).not.toMatch(/^0:/);
  });

  test("USER directive comes before CMD", () => {
    const userIdx = dockerfile.search(/^\s*USER\s+\S+/m);
    const cmdIdx = dockerfile.search(/^\s*CMD\s+\[/m);
    expect(userIdx).toBeGreaterThan(-1);
    expect(cmdIdx).toBeGreaterThan(-1);
    expect(userIdx).toBeLessThan(cmdIdx);
  });

  test("creates /app/icons directory for the volume mount", () => {
    expect(dockerfile).toMatch(/mkdir\s+-p[^\n]*\/app\/icons/);
  });
});

describe("SPEC-014 / REQ-087 — Supply chain hardening", () => {
  const dockerfile = read("Dockerfile");
  const pkg = JSON.parse(read("package.json"));

  test("Dockerfile runs npm audit gate at build time", () => {
    expect(dockerfile).toMatch(/npm\s+audit\s+--audit-level=high/);
  });

  test("package.json exposes npm run audit:check script", () => {
    expect(pkg.scripts["audit:check"]).toBeDefined();
    expect(pkg.scripts["audit:check"]).toMatch(/npm\s+audit/);
    expect(pkg.scripts["audit:check"]).toMatch(/--audit-level=high/);
  });

  test("new expansion dependencies are pinned to exact versions (no ^ or ~)", () => {
    // Per REQ-087 acceptance criteria — these dependencies should be
    // exact-pinned until the first release.
    const mustPin = [
      "multer",
      "gray-matter",
      "markdown-it",
      "sanitize-html",
      "@babel/standalone",
      "ajv",
      "ajv-formats",
      "p-limit",
      "@tanstack/react-virtual",
    ];
    for (const dep of mustPin) {
      const version = pkg.dependencies[dep];
      expect(version).toBeDefined();
      expect(version[0]).not.toBe("^");
      expect(version[0]).not.toBe("~");
    }
  });
});

describe("SPEC-014 / REQ-086 (F-CSP-01) — Production CSP hardening", () => {
  const middleware = read("middleware.ts");

  test("middleware.ts references NODE_ENV to split dev vs. production CSP", () => {
    expect(middleware).toMatch(/NODE_ENV/);
  });

  test("middleware.ts generates a per-request nonce in production", () => {
    // Look for crypto.getRandomValues or crypto.randomUUID — either is acceptable.
    expect(middleware).toMatch(/crypto\.(getRandomValues|randomUUID)/);
  });

  test("production script-src does NOT contain 'unsafe-inline'", () => {
    // Find the production script-src line(s). A simple heuristic: look
    // for a `script-src` template literal in a non-dev branch.
    // More robust: split by `isDev ?` ternary and check the false branch.
    const prodScriptSrcMatch = middleware.match(
      /script-src[^`]*'nonce-\$\{nonce\}'[^`]*'strict-dynamic'[^`]*/,
    );
    expect(prodScriptSrcMatch).not.toBeNull();
    // The matched production policy must not include 'unsafe-inline'.
    expect(prodScriptSrcMatch![0]).not.toMatch(/'unsafe-inline'/);
    expect(prodScriptSrcMatch![0]).not.toMatch(/'unsafe-eval'/);
  });

  test("CSP still allows Express API cross-origin (connect-src includes the API origin, default :8096)", () => {
    // The API origin is a variable (NEXT_PUBLIC_API_URL) defaulting to :8096.
    expect(middleware).toMatch(
      /apiOrigin = process\.env\.NEXT_PUBLIC_API_URL \|\| "http:\/\/localhost:8096"/,
    );
    expect(middleware).toMatch(/connect-src 'self' \$\{apiOrigin\}/);
  });

  test("CSP still allows iframe preview from the API origin (frame-src)", () => {
    expect(middleware).toMatch(/frame-src 'self' \$\{apiOrigin\}/);
  });

  test("CSP allows img-src data: (inline SVG / data URIs)", () => {
    expect(middleware).toMatch(/img-src[^`]*data:/);
  });

  test("style-src retains 'unsafe-inline' (Tailwind JIT; documented exception)", () => {
    expect(middleware).toMatch(/style-src[^`]*'unsafe-inline'/);
  });
});

describe("SPEC-014 / REQ-055 + REQ-080 — docker-compose icons volume + feature flags", () => {
  const compose = read("docker-compose.yml");

  test("mounts ./icons:/app/icons", () => {
    expect(compose).toMatch(/\.\/icons:\/app\/icons/);
  });

  test("declares DISABLE_PORTAL env var", () => {
    expect(compose).toMatch(/DISABLE_PORTAL=\$\{DISABLE_PORTAL:-0\}/);
  });

  test("declares DISABLE_ICONS env var", () => {
    expect(compose).toMatch(/DISABLE_ICONS=\$\{DISABLE_ICONS:-0\}/);
  });

  test("declares DISABLE_ENRICHED_COMPONENTS env var", () => {
    expect(compose).toMatch(/DISABLE_ENRICHED_COMPONENTS=\$\{DISABLE_ENRICHED_COMPONENTS:-0\}/);
  });

  test("declares PORTAL_INDEX env var (REQ-093 — secure-by-default opt-in)", () => {
    // Default value is empty (unset) — portal pages emit noindex,nofollow
    // unless PORTAL_INDEX=1 is explicitly supplied.
    expect(compose).toMatch(/PORTAL_INDEX=\$\{PORTAL_INDEX:-\}/);
  });
});

describe("SPEC-014 — README Feature Flags matrix", () => {
  const readme = read("README.md");

  test("README.md contains a Feature Flags section", () => {
    expect(readme).toMatch(/##\s+Feature Flags/);
  });

  test.each([
    "DISABLE_PORTAL",
    "DISABLE_ICONS",
    "DISABLE_ENRICHED_COMPONENTS",
    "PORTAL_INDEX",
    "DESIGN_API_KEY",
    "GITHUB_TOKEN",
  ])("documents %s flag", (flag) => {
    expect(readme).toContain(flag);
  });

  test("documents that DISABLE_PORTAL gates portal-specific API routes", () => {
    // REQ-092 acceptance criterion: matrix must document the route-by-route behavior.
    expect(readme).toMatch(/\/api\/brands\/:slug\/identity/);
    expect(readme).toMatch(/\/api\/brands\/:slug\/guidelines/);
  });
});
