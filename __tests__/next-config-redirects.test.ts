/**
 * Regression guard for the SPEC-008 REQ-067 redirect.
 *
 * `/components-library` must 301-permanently redirect to `/components` so
 * bookmarks and inbound links to the legacy page keep working.
 */

import { describe, it, expect } from "@jest/globals";
import nextConfig from "../next.config";

describe("next.config redirects", () => {
  it("declares the /components-library → /components redirect as permanent", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const list = await nextConfig.redirects!();
    const match = list.find((r) => r.source === "/components-library");
    expect(match).toBeDefined();
    expect(match!.destination).toBe("/components");
    expect(match!.permanent).toBe(true);
  });
});
