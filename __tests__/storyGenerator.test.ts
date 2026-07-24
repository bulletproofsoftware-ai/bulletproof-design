/**
 * Unit tests for story generator utility functions.
 */

import { toPascalCase, toDisplayName, generateStoryContent, getStoryPath } from "../src/api/lib/storyGenerator";

describe("toPascalCase", () => {
  test("converts kebab-case to PascalCase", () => {
    expect(toPascalCase("analytics-dashboard")).toBe("AnalyticsDashboard");
    expect(toPascalCase("my-template")).toBe("MyTemplate");
    expect(toPascalCase("hero-section")).toBe("HeroSection");
  });

  test("handles single word", () => {
    expect(toPascalCase("dashboard")).toBe("Dashboard");
  });

  test("handles multiple hyphens", () => {
    expect(toPascalCase("multi-step-wizard-form")).toBe("MultiStepWizardForm");
  });
});

describe("toDisplayName", () => {
  test("converts kebab-case to display name", () => {
    expect(toDisplayName("analytics-dashboard")).toBe("Analytics Dashboard");
    expect(toDisplayName("ai-interfaces")).toBe("Ai Interfaces");
  });

  test("handles single word", () => {
    expect(toDisplayName("dashboards")).toBe("Dashboards");
  });
});

describe("generateStoryContent", () => {
  test("generates valid CSF3 story content", () => {
    const content = generateStoryContent("dashboards", "analytics-dashboard");

    expect(content).toContain('import AnalyticsDashboard from "../../../templates/dashboards/analytics-dashboard"');
    expect(content).toContain('title: "Templates/Dashboards/Analytics Dashboard"');
    expect(content).toContain("component: AnalyticsDashboard");
    expect(content).toContain('layout: "fullscreen"');
    expect(content).toContain("export const Default: Story = {};");
    expect(content).toContain("export default meta;");
  });

  test("generates correct imports for different categories", () => {
    const content = generateStoryContent("auth", "login-page");
    expect(content).toContain("import LoginPage from");
    expect(content).toContain('title: "Templates/Auth/Login Page"');
  });
});

describe("getStoryPath", () => {
  test("returns correct story path", () => {
    const result = getStoryPath("/app/src", "dashboards", "analytics-dashboard");
    expect(result).toBe("/app/src/templates/dashboards/AnalyticsDashboard.stories.tsx");
  });

  test("throws on path traversal attempt", () => {
    expect(() => getStoryPath("/app/src", "../../etc", "passwd")).toThrow("Invalid path parameter");
  });
});
