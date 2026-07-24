/**
 * SPEC-013 REQ-072 — Unit tests for `lib/api.ts` (the Next.js-facing API
 * client).
 *
 * Scope: URL building, multipart construction, API key header wiring, and
 * error mapping for the expansion-era client functions. We mock the global
 * `fetch` so we can assert request shape deterministically without a live
 * Express server.
 *
 * Out of scope: the bulk of template/asset helpers — those are exercised
 * indirectly via the admin page tests and api-routes tests. This file
 * targets the REQ-062 client surface introduced by SPEC-010.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "@jest/globals";

// ─── Mock fetch ─────────────────────────────────────────────────────────
//
// We capture the last call so tests can introspect URL, method, headers,
// and body. Each test sets `mockResponse` to control what the SUT sees.

type CallRecord = {
  url: string;
  init?: RequestInit;
};

const calls: CallRecord[] = [];
let mockResponses: Array<() => Response> = [];

function makeResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    if (typeof body === "string") {
      headers.set("Content-Type", "text/plain");
    } else {
      headers.set("Content-Type", "application/json");
    }
  }
  const payload =
    typeof body === "string" ? body : JSON.stringify(body ?? {});
  return new Response(payload, { status, headers });
}

// Install a single, stable global.fetch replacement. Each test resets
// `mockResponses` to queue up what the SUT will see.
const originalFetch = globalThis.fetch;
globalThis.fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  calls.push({ url, init });
  const factory = mockResponses.shift();
  if (!factory) {
    throw new Error(`Unmocked fetch: ${url}`);
  }
  return Promise.resolve(factory());
};

beforeEach(() => {
  calls.length = 0;
  mockResponses = [];
});

afterEach(() => {
  // Sanity — nothing queued between tests.
  mockResponses = [];
});

// We import after the fetch shim is in place so the module captures the
// mocked global. lib/api.ts uses the runtime global, not a cached copy,
// so dynamic import order is not load-bearing — but we keep it late for
// symmetry with sibling tests.
const apiPromise = import("../lib/api");

// ─── URL Building ────────────────────────────────────────────────────────

describe("lib/api — URL building", () => {
  it("getBrands hits /api/brands without query string", async () => {
    const api = await apiPromise;
    mockResponses.push(() => makeResponse({ brands: [] }));
    await api.getBrands();
    expect(calls[0]!.url).toMatch(/\/api\/brands$/);
    expect(calls[0]!.init?.method ?? "GET").toBe("GET");
  });

  it("getBrand URL-encodes the slug only via template literal (server validates)", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ name: "Acme", slug: "acme", colors: {} }),
    );
    await api.getBrand("acme");
    expect(calls[0]!.url).toMatch(/\/api\/brands\/acme$/);
  });

  it("getTemplates encodes category and appends ?source=true only when requested", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ category: "dash boards", templates: [] }),
    );
    await api.getTemplates("dash boards", true);
    expect(calls[0]!.url).toContain("/api/templates/dash%20boards");
    expect(calls[0]!.url).toMatch(/\?source=true$/);
  });

  it("getTemplates omits the source flag when includeSource is false (default)", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ category: "dashboards", templates: [] }),
    );
    await api.getTemplates("dashboards");
    expect(calls[0]!.url).not.toContain("source=");
  });

  it("getIcons composes q/style/category/page/limit into a query string", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ items: [], total: 0, page: 1, limit: 10 }),
    );
    await api.getIcons({
      q: "home",
      style: "outlined",
      category: "Action",
      page: 2,
      limit: 25,
    });
    const u = new URL(calls[0]!.url);
    expect(u.pathname).toBe("/api/icons");
    expect(u.searchParams.get("q")).toBe("home");
    expect(u.searchParams.get("style")).toBe("outlined");
    expect(u.searchParams.get("category")).toBe("Action");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.get("limit")).toBe("25");
  });

  it("getIcons without params issues no query string at all", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ items: [], total: 0, page: 1, limit: 10 }),
    );
    await api.getIcons();
    expect(calls[0]!.url).toMatch(/\/api\/icons$/);
  });

  it("getIconSvgUrl returns the public URL without calling fetch", async () => {
    const api = await apiPromise;
    const url = api.getIconSvgUrl("home", "rounded");
    expect(url).toContain("/api/icons/home/svg");
    expect(url).toContain("style=rounded");
    expect(calls).toHaveLength(0);
  });
});

// ─── API key header wiring ──────────────────────────────────────────────

describe("lib/api — API key header", () => {
  it("putGuidelines sends x-api-key header and text/markdown body", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ ok: true, slug: "acme", bytes: 12 }),
    );
    await api.putGuidelines("acme", "# hi", "secret-key");
    const init = calls[0]!.init!;
    const headers = new Headers(init.headers as HeadersInit);
    expect(init.method).toBe("PUT");
    expect(headers.get("x-api-key")).toBe("secret-key");
    expect(headers.get("Content-Type")).toBe("text/markdown");
    expect(init.body).toBe("# hi");
  });

  it("putGuidelines rejects synchronously when apiKey is empty", async () => {
    const api = await apiPromise;
    await expect(
      api.putGuidelines("acme", "# hi", ""),
    ).rejects.toThrow(/API key is required/);
    // Also: no fetch call should have been made.
    expect(calls).toHaveLength(0);
  });

  it("uploadLogo refuses without an apiKey", async () => {
    const api = await apiPromise;
    const file = new File([new Uint8Array([1, 2, 3])], "h.svg", {
      type: "image/svg+xml",
    });
    await expect(
      api.uploadLogo(
        "acme",
        file,
        { key: "horizontal", label: "H", usage: "u" },
        "",
      ),
    ).rejects.toThrow(/API key is required/);
    expect(calls).toHaveLength(0);
  });

  it("deleteLogo sends x-api-key and DELETE", async () => {
    const api = await apiPromise;
    mockResponses.push(() => makeResponse({ ok: true }));
    await api.deleteLogo("acme", "horizontal", "my-key");
    const init = calls[0]!.init!;
    expect(init.method).toBe("DELETE");
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("x-api-key")).toBe("my-key");
  });

  it("deleteLogo treats 404 as idempotent success (no throw)", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ error: "Logo not found" }, { status: 404 }),
    );
    const res = await api.deleteLogo("acme", "horizontal", "my-key");
    expect(res.ok).toBe(true);
  });
});

// ─── Multipart construction ─────────────────────────────────────────────

describe("lib/api — multipart construction", () => {
  it("uploadLogo posts a FormData body with file + meta fields", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({
        ok: true,
        slug: "acme",
        key: "horizontal",
        file: "horizontal-abc.svg",
        url: "/brand-assets/acme/horizontal-abc.svg",
      }),
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"/>`;
    const file = new File([svg], "logo.svg", { type: "image/svg+xml" });
    await api.uploadLogo(
      "acme",
      file,
      {
        key: "horizontal",
        label: "Horizontal",
        usage: "Primary",
        preferred: true,
      },
      "key-123",
    );

    const init = calls[0]!.init!;
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("key")).toBe("horizontal");
    expect(body.get("label")).toBe("Horizontal");
    expect(body.get("usage")).toBe("Primary");
    expect(body.get("preferred")).toBe("true");
    const uploadedFile = body.get("file");
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe("logo.svg");
    expect((uploadedFile as File).type).toBe("image/svg+xml");
  });

  it("uploadLogo omits preferred when not supplied", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({
        ok: true,
        slug: "acme",
        key: "icon",
        file: "icon-x.svg",
        url: "/x",
      }),
    );

    const file = new File([new Uint8Array([0xff])], "i.png", {
      type: "image/png",
    });
    await api.uploadLogo(
      "acme",
      file,
      { key: "icon", label: "I", usage: "U" },
      "key",
    );
    const body = calls[0]!.init!.body as FormData;
    expect(body.get("preferred")).toBeNull();
  });
});

// ─── Error mapping ──────────────────────────────────────────────────────

describe("lib/api — error mapping", () => {
  it("getBrands throws with the server's `error` message on non-2xx", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse(
        { error: "Something broke" },
        { status: 500 },
      ),
    );
    await expect(api.getBrands()).rejects.toThrow(/Something broke/);
  });

  it("getBrand falls back to `(HTTP <status>)` when body has no JSON", async () => {
    const api = await apiPromise;
    mockResponses.push(
      () =>
        new Response("not-json", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    await expect(api.getBrand("whatever")).rejects.toThrow(
      /Failed to fetch brand: whatever \(HTTP 503\)/,
    );
  });

  it("getIcons propagates the server's REQ-079 normalized error envelope", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse(
        { error: "Invalid style", style: "weirdo" },
        { status: 400 },
      ),
    );
    await expect(
      // @ts-expect-error — deliberately invalid style for error-path test
      api.getIcons({ style: "weirdo" }),
    ).rejects.toThrow(/Invalid style/);
  });

  it("getGuidelinesRaw returns '' when the server returns 404", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ error: "guidelines.md not found for brand" }, { status: 404 }),
    );
    const raw = await api.getGuidelinesRaw("new-brand");
    expect(raw).toBe("");
  });

  it("getGuidelinesRaw throws on non-404 failures", async () => {
    const api = await apiPromise;
    mockResponses.push(() =>
      makeResponse({ error: "kaboom" }, { status: 500 }),
    );
    await expect(api.getGuidelinesRaw("x")).rejects.toThrow(/kaboom/);
  });
});

// ─── validateLogoFile (pure client-side gate) ──────────────────────────

describe("lib/api — validateLogoFile", () => {
  it("accepts SVG/PNG/JPEG under the size cap", async () => {
    const api = await apiPromise;
    const svg = new File([new Uint8Array(1024)], "h.svg", {
      type: "image/svg+xml",
    });
    expect(api.validateLogoFile(svg).ok).toBe(true);

    // Fall-back: empty MIME but .svg extension should still validate.
    const svgNoMime = new File([new Uint8Array(1024)], "h.svg", {
      type: "",
    });
    expect(api.validateLogoFile(svgNoMime).ok).toBe(true);

    const png = new File([new Uint8Array(1024)], "h.png", {
      type: "image/png",
    });
    expect(api.validateLogoFile(png).ok).toBe(true);
  });

  it("rejects files over the 5 MB cap", async () => {
    const api = await apiPromise;
    const bigSvg = new File(
      [new Uint8Array(api.LOGO_UPLOAD_MAX_BYTES + 1)],
      "big.svg",
      { type: "image/svg+xml" },
    );
    const res = api.validateLogoFile(bigSvg);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too large/i);
  });

  it("rejects disallowed MIME types", async () => {
    const api = await apiPromise;
    const gif = new File([new Uint8Array(10)], "x.gif", {
      type: "image/gif",
    });
    const res = api.validateLogoFile(gif);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Unsupported/);
  });
});

// ─── Restore global fetch on file teardown ─────────────────────────────

afterEach(() => {
  // nothing — we keep the shim for the whole file; restore below.
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
