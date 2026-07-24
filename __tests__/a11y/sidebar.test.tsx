/**
 * @jest-environment jsdom
 */
import { jest, test, expect } from "@jest/globals";
import { render } from "@testing-library/react";
import jestAxe from "jest-axe";
const { axe, toHaveNoViolations } = jestAxe;

expect.extend(toHaveNoViolations);

// Sidebar uses next/navigation hooks — mock them
jest.unstable_mockModule("next/navigation", () => ({
  usePathname: () => "/",
}));

// Mock fetch for API calls. The Sidebar now hits both /api/categories
// (SPEC-005) and /api/brands (SPEC-011 REQ-061), so the mock must return
// a shape that satisfies both endpoints. getBrands reads `data.brands`
// and getCategories reads the `categories` array, so returning both
// keys on every response is safe.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ categories: [], brands: [] }),
  })
) as unknown as typeof fetch;

test("Sidebar has no accessibility violations", async () => {
  // Dynamic import after mocks are set up
  const { Sidebar } = await import("@/components/features/Sidebar/Sidebar");
  const { container } = render(<Sidebar />);
  expect(await axe(container)).toHaveNoViolations();
});
