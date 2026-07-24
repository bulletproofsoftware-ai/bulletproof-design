/**
 * Structural tests for the LivePreview component.
 *
 * The project's Jest config uses testEnvironment: "node" and does not include
 * @testing-library/react or jsdom. The moduleNameMapper does not resolve @/*
 * paths, so we mock dependencies that use that alias and verify module-level
 * exports.
 */
import { describe, it, expect, jest } from "@jest/globals";

// Mock dependencies that live behind the @/ alias
jest.unstable_mockModule("@/components/ui/button", () => ({
  Button: "button",
}));
jest.unstable_mockModule("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

describe("LivePreview component module", () => {
  it("exports a named LivePreview function", async () => {
    const mod = await import("../components/features/LivePreview/LivePreview");
    expect(mod.LivePreview).toBeDefined();
    expect(typeof mod.LivePreview).toBe("function");
  });

  it("has the expected function name", async () => {
    const { LivePreview } = await import("../components/features/LivePreview/LivePreview");
    expect(LivePreview.name).toBe("LivePreview");
  });

  it("does not export a default export", async () => {
    const mod = await import("../components/features/LivePreview/LivePreview");
    expect((mod as Record<string, unknown>).default).toBeUndefined();
  });
});
