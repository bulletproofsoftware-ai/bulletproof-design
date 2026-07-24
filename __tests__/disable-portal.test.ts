/**
 * SPEC-014 / REQ-092 (F-FLAG-01) — DISABLE_PORTAL gates portal-specific
 * read API routes in the Express API, not just the Next.js /portal/* pages.
 *
 * Tests exercise the middleware directly against fake req/res triples.
 * The middleware lives in its own module (src/api/middleware/disablePortal.ts)
 * so it imports cleanly without starting the server.
 */

import { disablePortalGate, PORTAL_READ_PATH_RE } from "../src/api/middleware/disablePortal";

interface FakeRes {
  statusCode?: number;
  body?: unknown;
  status: (n: number) => { json: (body: unknown) => void };
}

function makeFakeRes(): FakeRes {
  const res: FakeRes = {
    status(n) {
      this.statusCode = n;
      return {
        json: (body) => {
          res.body = body;
        },
      };
    },
  };
  return res;
}

function runGate(
  method: string,
  path: string,
): { passed: boolean; res: FakeRes } {
  const res = makeFakeRes();
  let passed = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disablePortalGate({ method, path } as any, res as any, () => {
    passed = true;
  });
  return { passed, res };
}

describe("SPEC-014 / REQ-092 — DISABLE_PORTAL portal-read path gate", () => {
  const ORIGINAL = process.env.DISABLE_PORTAL;

  beforeEach(() => {
    delete process.env.DISABLE_PORTAL;
  });

  afterAll(() => {
    if (ORIGINAL === undefined) {
      delete process.env.DISABLE_PORTAL;
    } else {
      process.env.DISABLE_PORTAL = ORIGINAL;
    }
  });

  describe("path regex", () => {
    test.each([
      ["/default/identity", true],
      ["/default/logos", true],
      ["/default/typography", true],
      ["/default/guidelines", true],
      ["/default/identity/", true],
      ["/default/logos/", true],
      ["/default/colors", false],
      ["/default/fonts", false],
      ["/default/assets", false],
      ["/default/css-variables", false],
      ["/default", false],
      ["/", false],
      ["/default/logos/horizontal", false], // logo key path — admin DELETE, not portal read
      ["/default/identity/extra", false],
      ["/default/guidelines?raw=1", false], // query strings are stripped by Express — but req.path excludes them anyway
    ])("PORTAL_READ_PATH_RE.test(%j) === %s", (path, expected) => {
      expect(PORTAL_READ_PATH_RE.test(path)).toBe(expected);
    });
  });

  describe("flag OFF (default)", () => {
    test("GET /:slug/identity passes through", () => {
      const { passed, res } = runGate("GET", "/default/identity");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    test("GET /:slug/logos passes through", () => {
      const { passed, res } = runGate("GET", "/default/logos");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });
  });

  describe("flag ON (DISABLE_PORTAL=1) — portal reads 404", () => {
    beforeEach(() => {
      process.env.DISABLE_PORTAL = "1";
    });

    test.each([
      "/default/identity",
      "/default/logos",
      "/default/typography",
      "/default/guidelines",
    ])("GET %s returns 404", (path) => {
      const { passed, res } = runGate("GET", path);
      expect(passed).toBe(false);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: "Not found" });
    });
  });

  describe("flag ON — admin writes remain functional", () => {
    beforeEach(() => {
      process.env.DISABLE_PORTAL = "1";
    });

    test("POST /:slug/logos passes through", () => {
      const { passed, res } = runGate("POST", "/default/logos");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    test("DELETE /:slug/logos/:key passes through", () => {
      const { passed, res } = runGate("DELETE", "/default/logos/horizontal");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    test("PUT /:slug/guidelines passes through", () => {
      const { passed, res } = runGate("PUT", "/default/guidelines");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    test("PUT /:slug (admin brand update) passes through", () => {
      const { passed, res } = runGate("PUT", "/default");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });

    test("DELETE /:slug passes through", () => {
      const { passed, res } = runGate("DELETE", "/default");
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });
  });

  describe("flag ON — admin reads remain functional", () => {
    beforeEach(() => {
      process.env.DISABLE_PORTAL = "1";
    });

    test.each([
      "/",
      "/default",
      "/default/colors",
      "/default/fonts",
      "/default/assets",
      "/default/css-variables",
    ])("GET %s passes through", (path) => {
      const { passed, res } = runGate("GET", path);
      expect(passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    });
  });
});
