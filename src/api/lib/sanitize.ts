/**
 * Input sanitization helpers for path parameters and URL inputs.
 *
 * These complement the validation functions in validation.ts by actively
 * stripping dangerous characters rather than just returning boolean checks.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import * as path from "node:path";

/**
 * Resolve `candidate` against `root` and prove the result stays inside `root`.
 *
 * Containment must be asserted on the *final* path that reaches the filesystem
 * call, not on the directory it was built from: checking the parent and then
 * appending a segment leaves the appended segment unchecked, and it is also
 * invisible to dataflow analysis (CodeQL js/path-injection).
 *
 * Returns the resolved absolute path; throws if it escapes.
 */
export function resolveWithin(root: string, ...candidate: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Path escapes its permitted root");
  }
  return resolved;
}

/**
 * Sanitizes a path parameter by rejecting traversal sequences, null bytes,
 * and path separators, then stripping any remaining non-safe characters.
 *
 * Throws on obviously malicious input; returns a clean alphanumeric-dash-underscore string.
 */
export function sanitizePathParam(param: string): string {
  if (!param || typeof param !== "string") {
    throw new Error("Invalid path parameter");
  }
  // eslint-disable-next-line no-control-regex
  if (/[/\\]|\.\.|[\x00]/.test(param)) {
    throw new Error("Invalid path parameter");
  }
  const sanitized = param.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized || sanitized.length === 0) {
    throw new Error("Invalid path parameter");
  }
  return sanitized;
}

/**
 * Validates and sanitizes a URL for server-side fetching (SSRF protection).
 *
 * - Only allows http: and https: protocols
 * - Blocks private/reserved IP ranges and localhost
 * - Rejects URLs with credentials (user:pass@)
 * - Maximum length check
 */
/**
 * Checks whether an IP address falls within private/reserved ranges.
 */
function isPrivateIp(ip: string): boolean {
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,       // link-local
    /^::1$/,             // IPv6 loopback
    /^fc/,               // IPv6 unique local
    /^fd/,               // IPv6 unique local
    /^fe80:/,            // IPv6 link-local
  ];
  for (const pattern of privatePatterns) {
    if (pattern.test(ip)) return true;
  }
  return false;
}

export async function sanitizeUrl(urlString: string): Promise<string> {
  if (!urlString || typeof urlString !== "string" || urlString.length > 2048) {
    throw new Error("Invalid URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL: must be a valid absolute URL");
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid URL: only http and https protocols are allowed");
  }

  // Block credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error("Invalid URL: credentials not allowed");
  }

  // Block localhost and private IPs (hostname string check)
  const hostname = parsed.hostname.toLowerCase();
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,       // link-local
    /^\[::1\]$/,         // IPv6 loopback
    /^\[fc/,             // IPv6 unique local
    /^\[fd/,             // IPv6 unique local
    /^\[fe80:/,          // IPv6 link-local
    /^metadata\./,       // cloud metadata
    /\.internal$/,       // internal domains
    /\.local$/,          // mDNS
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error("Invalid URL: private or reserved addresses are not allowed");
    }
  }

  // DNS rebinding protection — resolve hostname and check the actual IP
  try {
    const result = await dnsLookup(hostname);
    if (isPrivateIp(result.address)) {
      throw new Error("Invalid URL: resolved to a private or reserved IP address");
    }
  } catch (err: unknown) {
    // Re-throw our own errors; treat DNS failures as blocked
    if (err instanceof Error && err.message?.startsWith("Invalid URL:")) throw err;
    throw new Error("Invalid URL: could not resolve hostname", { cause: err });
  }

  return parsed.href;
}

/**
 * fetch() that re-validates every redirect hop with {@link sanitizeUrl}.
 *
 * sanitizeUrl checks the scheme, rejects embedded credentials, blocks private
 * and link-local ranges and resolves the hostname to defeat DNS rebinding —
 * but it only ever sees the URL the caller passed. With `redirect: "follow"`
 * the runtime chases 3xx responses itself, so a permitted host could answer
 * `302 Location: http://127.0.0.1/...` (or a cloud metadata endpoint) and the
 * request would be made with none of those checks applied to the new target.
 *
 * Redirects are therefore followed manually, with each hop passed back through
 * sanitizeUrl before it is requested.
 */
export async function fetchNoRebind(
  url: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  let current = await sanitizeUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual" });

    if (response.status < 300 || response.status > 399) return response;

    const location = response.headers.get("location");
    if (!location) return response;

    // Resolve relative Location headers against the current URL, then run the
    // whole thing through the same checks the original target had to pass.
    const next = new URL(location, current).href;
    current = await sanitizeUrl(next);
  }

  throw new Error("Invalid URL: too many redirects");
}
