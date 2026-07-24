import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Explicitly marks a route as public — no authentication required.
 * Applied as route-level middleware so scanners can detect the auth decision.
 */
export function publicAccess(_req: Request, _res: Response, next: NextFunction) {
  // Explicitly public — no authentication required
  next();
}

/**
 * Simple API key auth for write operations.
 * Set DESIGN_API_KEY env var to enable. In production (NODE_ENV=production), it is required.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.DESIGN_API_KEY;

  // If no API key configured, allow all (dev mode) but warn
  if (!apiKey) {
    next();
    return;
  }

  const providedHeader = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : "";
  if (providedHeader && safeCompare(providedHeader, apiKey)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized — provide X-Api-Key header" });
}

/**
 * Validates that DESIGN_API_KEY is set. Call at startup.
 * In production, refuses to start without it. In dev, logs a warning.
 */
export function validateApiKeyConfig(): void {
  if (!process.env.DESIGN_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error("[FATAL] DESIGN_API_KEY must be set in production");
      process.exit(1);
    }
    console.warn("[WARNING] DESIGN_API_KEY is not set — all write operations are unauthenticated.");
  }
}
