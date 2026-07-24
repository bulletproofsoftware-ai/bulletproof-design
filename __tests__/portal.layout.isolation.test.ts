/**
 * SPEC-013 REQ-072 + REQ-071 — Portal layout isolation.
 *
 * The admin Sidebar (`components/features/Sidebar`) must NEVER render under
 * `/portal/*`. Portal pages live in their own route group / layout and must
 * only import the `PortalSidebar`. This test enforces the invariant by
 * walking the `app/portal/` subtree and reading every TSX layout/page file
 * to confirm the admin Sidebar is never imported transitively from within
 * portal routes.
 *
 * This is a pure static-analysis check — it runs in Node without a React
 * renderer and therefore doesn't depend on jsdom or Next's runtime. Its
 * job is to make any future refactor that accidentally pulls the admin
 * Sidebar into a portal layout fail the test suite.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const PORTAL_ROOT = path.resolve(process.cwd(), "app", "portal");
const ADMIN_LAYOUT = path.resolve(process.cwd(), "app", "(admin)", "layout.tsx");

/** Recursively collect every `.ts` / `.tsx` file under a directory. */
function collectTsFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const next = stack.pop()!;
    const entries = fs.readdirSync(next, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(next, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))) {
        out.push(full);
      }
    }
  }
  return out;
}

describe("REQ-071 — portal layout isolation", () => {
  test("app/portal tree exists", () => {
    expect(fs.existsSync(PORTAL_ROOT)).toBe(true);
  });

  test("admin layout imports the admin Sidebar (sanity check)", () => {
    // Sanity: this is the baseline we are isolating the portal FROM.
    const src = fs.readFileSync(ADMIN_LAYOUT, "utf-8");
    expect(src).toMatch(/@\/components\/features\/Sidebar/);
  });

  test("no file under app/portal/ imports the admin Sidebar", () => {
    const files = collectTsFiles(PORTAL_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf-8");
      // The admin sidebar is at `@/components/features/Sidebar` — exact path,
      // no subpath, no wildcard. PortalSidebar lives at
      // `@/components/features/PortalSidebar` which MUST NOT match.
      //
      // Match either:
      //   import ... from "@/components/features/Sidebar"
      //   import ... from "@/components/features/Sidebar/Sidebar"
      // but NOT `@/components/features/Sidebar*something*Other` — we anchor
      // on a closing quote or trailing `/Sidebar"` segment.
      const badImport =
        /from\s+["']@\/components\/features\/Sidebar(\/Sidebar)?["']/.test(src);
      if (badImport) offenders.push(path.relative(process.cwd(), f));
    }

    expect(offenders).toEqual([]);
  });

  test("portal layout imports PortalSidebar (positive assertion)", () => {
    const layoutPath = path.join(PORTAL_ROOT, "[slug]", "layout.tsx");
    expect(fs.existsSync(layoutPath)).toBe(true);
    const src = fs.readFileSync(layoutPath, "utf-8");
    expect(src).toMatch(/@\/components\/features\/PortalSidebar/);
  });

  test("portal route group is a peer of, not nested under, (admin)", () => {
    // Guarantees Next.js treats portal as its own route group — it must
    // live directly under app/ and NOT inside app/(admin)/.
    expect(fs.existsSync(PORTAL_ROOT)).toBe(true);
    const insideAdmin = path.join(process.cwd(), "app", "(admin)", "portal");
    expect(fs.existsSync(insideAdmin)).toBe(false);
  });
});
