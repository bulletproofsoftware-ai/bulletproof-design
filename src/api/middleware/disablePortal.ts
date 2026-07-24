/**
 * SPEC-014 / REQ-092 (F-FLAG-01) — DISABLE_PORTAL feature flag middleware.
 *
 * The flag gates portal-specific *read* routes in the Express API so a
 * DISABLE_PORTAL=1 deployment cannot be scraped via the API layer, even
 * when the Next.js /portal/* routes are disabled.
 *
 * Routes 404'd when DISABLE_PORTAL=1 (GET only):
 *   - /:slug/identity
 *   - /:slug/logos
 *   - /:slug/typography
 *   - /:slug/guidelines
 *
 * Routes that REMAIN functional when DISABLE_PORTAL=1:
 *   - Admin reads: GET /:slug, /:slug/colors, /:slug/fonts, /:slug/css-variables, /:slug/assets
 *   - Admin writes: POST/PUT/DELETE (all methods — regardless of path)
 *
 * The path regex is mounted under `/api/brands`, so `req.path` is the
 * suffix after that prefix — e.g. `/default/identity`.
 */

import type { Request, Response, NextFunction } from "express";

export const PORTAL_READ_PATH_RE =
  /^\/[^/]+\/(identity|logos|typography|guidelines)\/?$/;

export function disablePortalGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.DISABLE_PORTAL === "1" && req.method === "GET") {
    if (PORTAL_READ_PATH_RE.test(req.path)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
  }
  next();
}
