/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import * as api from "../lib/api";

describe("every write helper sends x-api-key", () => {
  const orig = global.fetch;
  beforeEach(() => { window.localStorage.setItem("design-api-key", "stored-key"); });
  afterEach(() => { global.fetch = orig; window.localStorage.clear(); });

  async function capture(fn: () => Promise<unknown>) {
    let seen: any = null;
    global.fetch = jest.fn(async (_u: any, o: any) => {
      seen = o; return { ok: true, json: async () => ({}) } as any;
    }) as any;
    await fn();
    return seen;
  }

  it("createBrand", async () => {
    const o = await capture(() => api.createBrand({} as any));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
  it("updateBrand", async () => {
    const o = await capture(() => api.updateBrand("acme", {} as any));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
  it("deleteBrand", async () => {
    const o = await capture(() => api.deleteBrand("acme"));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
  it("createTemplate", async () => {
    const o = await capture(() => api.createTemplate({ category: "c", name: "n", sourceCode: "x" } as any));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
  it("updateTemplate", async () => {
    const o = await capture(() => api.updateTemplate("c", "n", "src"));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
  it("deleteTemplate", async () => {
    const o = await capture(() => api.deleteTemplate("c", "n"));
    expect(o.headers["x-api-key"]).toBe("stored-key");
  });
});
