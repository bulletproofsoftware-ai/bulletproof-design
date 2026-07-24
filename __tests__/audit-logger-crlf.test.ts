/**
 * REQ-095 — CRLF injection neutralisation in the audit logger.
 *
 * A user-controlled field (slug, path, user-agent, detail) containing
 * `\r\n` must NOT produce multiple log lines when audited. This test
 * drives `logAudit` directly with a crafted Express request and asserts
 * that the emitted stdout contains exactly one `[audit]` line with the
 * newline replaced by a single space.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import type { Request } from "express";

import { logAudit } from "../src/api/lib/auditLogger";

/**
 * Build a minimal Express-shaped request with only the fields the audit
 * logger reads. Everything else is left `undefined` — the logger must
 * cope with the sparse shape.
 */
function makeReq(overrides: Partial<Request> = {}): Request {
  const headers = {
    "user-agent": "jest-runner",
    ...(overrides.headers ?? {}),
  };
  return {
    method: "POST",
    originalUrl: "/api/brands/default/logos",
    ip: "127.0.0.1",
    headers,
    ...overrides,
    // Always preserve merged headers last.
    ...(overrides.headers ? {} : {}),
  } as unknown as Request;
}

describe("REQ-095 — audit logger CRLF stripping", () => {
  let logs: string[];
  let origLog: typeof console.log;

  beforeEach(() => {
    logs = [];
    origLog = console.log;
    console.log = jest.fn((msg: unknown, ...rest: unknown[]) => {
      logs.push(String(msg));
      // Still forward to the original for debugging when jest --verbose is on.
      return origLog.call(console, msg, ...rest);
    }) as unknown as typeof console.log;
  });

  afterEach(() => {
    console.log = origLog;
  });

  test("CRLF in originalUrl is replaced with a space (no line injection)", () => {
    const req = makeReq({
      originalUrl: "/api/brands/evil\r\nFAKE AUDIT ip=1.2.3.4",
    });
    logAudit(req, "success", 200);

    // Exactly one [audit] line emitted.
    const auditLines = logs.filter((l) => l.startsWith("[audit]"));
    expect(auditLines).toHaveLength(1);

    // The single line must not contain a raw CR or LF.
    expect(auditLines[0]).not.toMatch(/\r/);
    // The surrounding template wraps the JSON in `[audit] ...` so no
    // raw newlines may appear inside the JSON payload either.
    const jsonPart = auditLines[0]!.replace(/^\[audit\] /, "");
    const parsed = JSON.parse(jsonPart);
    expect(parsed.path).toBe("/api/brands/evil  FAKE AUDIT ip=1.2.3.4");
    expect(parsed.path).not.toMatch(/[\r\n]/);
  });

  test("CRLF in user-agent header is replaced with a space", () => {
    const req = makeReq({
      headers: { "user-agent": "Mozilla/5.0\r\nFAKE AUDIT" },
    });
    logAudit(req, "success", 200);

    const auditLines = logs.filter((l) => l.startsWith("[audit]"));
    expect(auditLines).toHaveLength(1);
    const parsed = JSON.parse(auditLines[0]!.replace(/^\[audit\] /, ""));
    expect(parsed.userAgent).toBe("Mozilla/5.0  FAKE AUDIT");
    expect(parsed.userAgent).not.toMatch(/[\r\n]/);
  });

  test("CRLF in detail string is replaced with a space", () => {
    const req = makeReq();
    logAudit(req, "denied", 400, "bad input\r\nINJECTED");

    const auditLines = logs.filter((l) => l.startsWith("[audit]"));
    expect(auditLines).toHaveLength(1);
    const parsed = JSON.parse(auditLines[0]!.replace(/^\[audit\] /, ""));
    expect(parsed.detail).toBe("bad input  INJECTED");
    expect(parsed.detail).not.toMatch(/[\r\n]/);
  });

  test("CRLF in ip field is replaced (defence in depth)", () => {
    // req.ip is normally Express-validated but the logger should still
    // scrub it — belt-and-braces against a misbehaving middleware.
    const req = makeReq({ ip: "127.0.0.1\r\nevil" });
    logAudit(req, "success", 200);

    const auditLines = logs.filter((l) => l.startsWith("[audit]"));
    expect(auditLines).toHaveLength(1);
    const parsed = JSON.parse(auditLines[0]!.replace(/^\[audit\] /, ""));
    expect(parsed.ip).toBe("127.0.0.1  evil");
    expect(parsed.ip).not.toMatch(/[\r\n]/);
  });

  test("clean inputs are unchanged — no false positives", () => {
    const req = makeReq({ originalUrl: "/api/brands/default/logos" });
    logAudit(req, "success", 200, "logos.uploaded slug=default key=mark");

    const auditLines = logs.filter((l) => l.startsWith("[audit]"));
    expect(auditLines).toHaveLength(1);
    const parsed = JSON.parse(auditLines[0]!.replace(/^\[audit\] /, ""));
    expect(parsed.path).toBe("/api/brands/default/logos");
    expect(parsed.detail).toBe("logos.uploaded slug=default key=mark");
  });
});
