import { Request } from "express";

interface AuditEntry {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  apiKeyPresent: boolean;
  userAgent: string;
  outcome: "success" | "error" | "denied";
  statusCode?: number;
  detail?: string;
}

/**
 * Neutralise CRLF sequences in user-controlled strings before they reach
 * stdout (REQ-095, CISO F-AUDIT-02). A crafted URL or User-Agent containing
 * `\r\n` could otherwise inject a forged audit line ahead of the real one
 * when a downstream log aggregator splits on newlines.
 *
 * JSON.stringify already escapes newlines inside quoted values, but we run
 * this BEFORE serialisation so the prefix and any non-JSON consumer see a
 * single-line entry regardless of the pipeline.
 */
function stripCrlf(value: string): string {
  return value.replace(/[\r\n]/g, " ");
}

/**
 * Logs a structured audit entry for security-critical operations.
 * Covers CWE-778 (Insufficient Logging) by recording identity,
 * timestamp, operation, and outcome for every mutating request.
 */
export function logAudit(
  req: Request,
  outcome: AuditEntry["outcome"],
  statusCode?: number,
  detail?: string
): void {
  const rawUserAgent = (req.headers["user-agent"] ?? "unknown").slice(0, 200);
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: stripCrlf(req.originalUrl),
    ip: stripCrlf(req.ip ?? "unknown"),
    apiKeyPresent: !!req.headers["x-api-key"] || !!req.headers.authorization,
    userAgent: stripCrlf(rawUserAgent),
    outcome,
    ...(statusCode !== undefined && { statusCode }),
    ...(detail !== undefined && { detail: stripCrlf(detail) }),
  };
  // Structured JSON log line for audit trail consumption
  console.log(`[audit] ${JSON.stringify(entry)}`);
}
