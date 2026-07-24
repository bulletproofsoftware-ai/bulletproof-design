/**
 * SPEC-010 / REQ-062 — lib/api.ts import boundary regression test.
 *
 * `lib/api.ts` runs under the Next.js compilation boundary, which EXCLUDES
 * `src/api/**` (see tsconfig.json → `"exclude": ["src/api"]`). Any import in
 * `lib/api.ts` from `src/api/...` — whether via the `@/src/api` alias or a
 * relative path — would silently break the Next.js production build because
 * tsc skips those files during `next build`.
 *
 * This test enforces the boundary at the source level so regressions are
 * caught by `npm test` without needing to run a full production build.
 *
 * It ALSO asserts that `lib/types/api.ts` (the SSoT for shared API types)
 * stays runtime-free of `src/api/**` imports. A runtime import there would
 * bundle server-only code into the Next.js client build.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
const LIB_API = path.join(PROJECT_ROOT, "lib", "api.ts");
const LIB_TYPES_API = path.join(PROJECT_ROOT, "lib", "types", "api.ts");

/**
 * Matches any static import or re-export specifier that resolves into
 * `src/api/...`, in any of the three ways it could be written:
 *   - bare alias:      `@/src/api/...`
 *   - leading slash:   `/src/api/...` (unusual, but possible)
 *   - relative path:   `../src/api/...` or deeper
 */
const FORBIDDEN_SPECIFIER =
  /(?:from|import)\s+['"](?:@\/src\/api|\/src\/api|(?:\.\.\/)+src\/api)(?:\/[^'"]*)?['"]/;

function loadLines(file: string): string[] {
  const source = fs.readFileSync(file, "utf-8");
  return source.split(/\r?\n/);
}

function forbiddenLines(
  file: string,
): Array<{ line: number; text: string }> {
  const hits: Array<{ line: number; text: string }> = [];
  loadLines(file).forEach((text, idx) => {
    if (FORBIDDEN_SPECIFIER.test(text)) {
      hits.push({ line: idx + 1, text: text.trim() });
    }
  });
  return hits;
}

describe("lib/api.ts — Next.js compilation boundary (REQ-062)", () => {
  it("never imports from @/src/api, /src/api, or ../src/api", () => {
    const hits = forbiddenLines(LIB_API);
    if (hits.length > 0) {
      const detail = hits
        .map(
          ({ line, text }) =>
            `  ${path.relative(PROJECT_ROOT, LIB_API)}:${line}  ${text}`,
        )
        .join("\n");
      throw new Error(
        `lib/api.ts must not import from src/api/** — tsconfig excludes that path from the Next.js build.\n` +
          `Move the shared type into lib/types/api.ts and import from there.\n\n` +
          `Offending lines:\n${detail}`,
      );
    }
    expect(hits).toEqual([]);
  });

  it("only resolves relative imports to the types/ neighbour (no reach into src/api)", () => {
    const lines = loadLines(LIB_API);
    const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g;
    const violations: Array<{ line: number; specifier: string }> = [];

    lines.forEach((text, idx) => {
      importRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = importRe.exec(text)) !== null) {
        const specifier = match[1];
        // Bare specifiers (external packages) are fine.
        if (
          !specifier.startsWith(".") &&
          !specifier.startsWith("/") &&
          !specifier.startsWith("@/")
        ) {
          continue;
        }
        // @/ alias — reject @/src/api/** explicitly.
        if (specifier.startsWith("@/")) {
          if (specifier.startsWith("@/src/api")) {
            violations.push({ line: idx + 1, specifier });
          }
          continue;
        }
        // Relative imports — reject any ../src/api/**.
        if (/^(?:\.\.\/)+src\/api/.test(specifier)) {
          violations.push({ line: idx + 1, specifier });
        }
      }
    });

    expect(violations).toEqual([]);
  });
});

describe("lib/types/api.ts — SSoT boundary (REQ-062)", () => {
  it("never imports runtime code from src/api/**", () => {
    const hits = forbiddenLines(LIB_TYPES_API);
    expect(hits).toEqual([]);
  });
});
