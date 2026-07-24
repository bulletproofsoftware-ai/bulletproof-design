/**
 * Unit tests for the shared validation utilities.
 */

import { validateParam, validateSearchQuery, validateFilename, sanitizeErrorMessage } from "../src/api/lib/validation";

describe("validateParam", () => {
  test("accepts valid alphanumeric params", () => {
    expect(validateParam("dashboards")).toBe(true);
    expect(validateParam("analytics-dashboard")).toBe(true);
    expect(validateParam("my_template")).toBe(true);
    expect(validateParam("Template123")).toBe(true);
  });

  test("rejects empty string", () => {
    expect(validateParam("")).toBe(false);
  });

  test("rejects params with spaces", () => {
    expect(validateParam("my template")).toBe(false);
  });

  test("rejects params with path traversal characters", () => {
    expect(validateParam("../etc")).toBe(false);
    expect(validateParam("..")).toBe(false);
    expect(validateParam("foo/bar")).toBe(false);
    expect(validateParam("foo\\bar")).toBe(false);
  });

  test("rejects params with special characters", () => {
    expect(validateParam("foo@bar")).toBe(false);
    expect(validateParam("foo!bar")).toBe(false);
    expect(validateParam("<script>")).toBe(false);
  });

  test("rejects params exceeding 100 characters", () => {
    expect(validateParam("a".repeat(100))).toBe(true);
    expect(validateParam("a".repeat(101))).toBe(false);
  });
});

describe("validateSearchQuery", () => {
  test("accepts normal search queries", () => {
    expect(validateSearchQuery("dashboard")).toBe(true);
    expect(validateSearchQuery("AI chat interface")).toBe(true);
    expect(validateSearchQuery("color picker #hex")).toBe(true);
  });

  test("rejects queries with control characters", () => {
    expect(validateSearchQuery("test\x00null")).toBe(false);
    expect(validateSearchQuery("test\x0Atab")).toBe(false);
  });

  test("rejects queries exceeding 200 characters", () => {
    expect(validateSearchQuery("a".repeat(200))).toBe(true);
    expect(validateSearchQuery("a".repeat(201))).toBe(false);
  });
});

describe("validateFilename", () => {
  test("accepts valid filenames", () => {
    expect(validateFilename("image.png")).toBe(true);
    expect(validateFilename("my-logo_v2.svg")).toBe(true);
    expect(validateFilename("favicon.ico")).toBe(true);
  });

  test("rejects filenames with path separators", () => {
    expect(validateFilename("../secret.txt")).toBe(false);
    expect(validateFilename("foo/bar.png")).toBe(false);
    expect(validateFilename("foo\\bar.png")).toBe(false);
  });

  test("rejects filenames with special characters", () => {
    expect(validateFilename("file name.png")).toBe(false);
    expect(validateFilename("file@name.png")).toBe(false);
  });

  test("rejects empty filename", () => {
    expect(validateFilename("")).toBe(false);
  });

  test("rejects filenames exceeding 255 characters", () => {
    expect(validateFilename("a".repeat(250) + ".png")).toBe(true);
    expect(validateFilename("a".repeat(256))).toBe(false);
  });
});

describe("sanitizeErrorMessage", () => {
  test("returns first line only", () => {
    expect(sanitizeErrorMessage("Error\nStack trace line 1\nStack trace line 2"))
      .toBe("Error");
  });

  test("truncates to 200 characters", () => {
    const long = "x".repeat(300);
    expect(sanitizeErrorMessage(long).length).toBe(200);
  });

  test("handles empty string", () => {
    expect(sanitizeErrorMessage("")).toBe("");
  });

  test("passes through short messages unchanged", () => {
    expect(sanitizeErrorMessage("File not found")).toBe("File not found");
  });
});
