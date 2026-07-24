import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Content Security Policy middleware (REQ-081, REQ-086 / F-CSP-01).
 *
 * Environment-split CSP:
 * - Development (NODE_ENV !== "production"): permissive to allow HMR, Fast
 *   Refresh, and Monaco eval. Retains 'unsafe-inline' and 'unsafe-eval' on
 *   script-src.
 * - Production: NO 'unsafe-inline' and NO 'unsafe-eval' on script-src.
 *   Per-request nonces are generated and attached to the response via the
 *   `x-nonce` request header (read by `app/layout.tsx` and Next.js <Script>
 *   components). `'strict-dynamic'` allows nonced scripts to load further
 *   scripts without re-nonce overhead, which is the Next.js-recommended
 *   pattern for App Router + middleware nonces.
 *
 *   `'unsafe-inline'` on *style-src* is retained — Tailwind JIT emits
 *   inline <style> blocks and the XSS amplification surface on styles is
 *   drastically smaller than on scripts (no script execution).
 *
 * REQ-081 preserved behaviors:
 * - img-src includes `data:` (inline SVG + data URIs on admin preview surfaces).
 * - connect-src and frame-src include `http://localhost:8096` (Express API cross-origin).
 * - font-src allows `data:` and Google Fonts.
 * - Monaco editor assets load from `https://cdn.jsdelivr.net`.
 *
 * Failure mode: if Tailwind JIT or shadcn components produce inline script
 * blocks that cannot be nonce-tagged (empirically observed after build),
 * document the SPECIFIC blocker in this file and reassess — do NOT silently
 * re-add 'unsafe-inline' to script-src.
 */

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  const monacoOrigin = "https://cdn.jsdelivr.net";

  // API origin for CSP allowlists. NEXT_PUBLIC_API_URL is injected at build
  // time by Next.js; middleware also reads it at request time in the Edge
  // runtime. Default preserves the legacy localhost:8096 mapping.
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

  // Per-request nonce (production only). Use the Web Crypto API so this
  // works in the Edge runtime where Node's `crypto` module is unavailable.
  let nonce = "";
  if (!isDev) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // btoa-equivalent — base64 of 16 random bytes (128 bits).
    nonce = btoa(String.fromCharCode(...bytes));
  }

  // script-src policy:
  // - Dev: permissive for HMR / Monaco eval.
  // - Prod: 'self' + per-request nonce + 'strict-dynamic'. No 'unsafe-inline'.
  //   `blob:` retained for Monaco web workers loaded via Blob URLs.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: ${monacoOrigin}`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob: ${monacoOrigin}`;

  const cspHeader = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${monacoOrigin}`,
    `font-src 'self' https://fonts.gstatic.com data: ${monacoOrigin}`,
    `img-src 'self' data: ${apiOrigin} https://fonts.gstatic.com https://image.thum.io`,
    `connect-src 'self' ${apiOrigin} ws://localhost:8095 ${monacoOrigin}`,
    `frame-src 'self' ${apiOrigin}`,
    `worker-src 'self' blob:`,
    `child-src 'self' blob:`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");

  // Forward the nonce to downstream server components through a request
  // header so layouts can read it via `headers()` and pass it to <Script>.
  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeader);
  if (nonce) {
    // Surface the nonce on the response too so client-side tooling and
    // observability can correlate it with any CSP report.
    response.headers.set("x-nonce", nonce);
  }
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    { source: "/(.*)" },
  ],
};
