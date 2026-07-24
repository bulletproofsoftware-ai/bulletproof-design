import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { buildIndex } from "./lib/templateIndex";
import { buildBrandIndex } from "./lib/brandIndex";
import { loadIconIndex } from "./lib/iconIndex";
import categoriesRouter from "./routes/categories";
import templatesRouter from "./routes/templates";
import componentsRouter from "./routes/components";
import searchRouter from "./routes/search";
import brandsRouter, { brandAssetsStaticRouter } from "./routes/brands";
import importRouter from "./routes/import";
import assetsRouter from "./routes/assets";
import previewRouter from "./routes/preview";
import iconsRouter from "./routes/icons";
import { validateApiKeyConfig, safeCompare } from "./middleware/auth";
import { disablePortalGate } from "./middleware/disablePortal";

const app = express();
const PORT = parseInt(process.env.PORT || "8096", 10);
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || "./templates";
const BRANDS_DIR = process.env.BRANDS_DIR || "./brands";
const ASSETS_DIR = process.env.ASSETS_DIR || "./assets";
const ICONS_DIR = process.env.ICONS_DIR || "./icons/material-symbols";

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
}));
app.disable("x-powered-by");

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? (process.env.CORS_ORIGIN || "http://localhost:8095").split(",")
    : true,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Request timeout — abort long-running requests after 30 seconds
app.use((_req, res, next) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout" });
    }
  });
  next();
});

// Rate limiting
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  return readLimiter(req, res, next);
});

// Audit logging for security-critical operations
app.use((req, _res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    console.log(`[audit] ${new Date().toISOString()} ${req.method} ${req.originalUrl} from ${req.ip}`);
  }
  next();
});

// Auth middleware for write operations (POST/PUT/DELETE)
// Set DESIGN_API_KEY env var to enable. In production, it is required.
app.use("/api", (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const apiKey = process.env.DESIGN_API_KEY;
  if (!apiKey) return next();
  const providedHeader = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : "";
  if (providedHeader && safeCompare(providedHeader, apiKey)) return next();
  res.status(401).json({ error: "Unauthorized — provide X-Api-Key header" });
});

// Preview endpoint — allow cross-origin embedding from the Next.js app.
// `frame-ancestors` must include the browser-visible origin of the embedder,
// which is the host-mapped Next.js port (e.g. http://localhost:8083), NOT the
// container-internal 8095. CORS_ORIGIN already holds the correct value.
const previewFrameAncestors = (process.env.CORS_ORIGIN || "http://localhost:8095")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .join(" ");
app.use("/preview", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.removeHeader("X-Frame-Options");
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.setHeader("Content-Security-Policy",
    "default-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    `frame-ancestors 'self' ${previewFrameAncestors}`
  );
  next();
}, previewRouter);

// Static assets — allow cross-origin loading from the Next.js app
app.use("/assets", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(ASSETS_DIR, {
  maxAge: "1h",
  etag: true,
}));

// Brand asset static route — SPEC-004 REQ-063 / CISO F-STATIC-02.
// Serves `brands/<slug>/assets/*` with sanitize-on-read for SVG and strict
// MIME/filename validation. Lives outside `/api` so CORS/auth gates above
// do not apply — it is a read-only asset endpoint intended for direct
// browser consumption.
app.use("/brand-assets", brandAssetsStaticRouter);

// Health check
app.get("/api/health", (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.json({
    status: "ok",
    service: "design-library-api",
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { templatesDir: TEMPLATES_DIR, assetsDir: ASSETS_DIR }),
  });
});

// Mount routers
app.use("/api/categories", categoriesRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/components", componentsRouter);
app.use("/api/search", searchRouter);

// DISABLE_PORTAL — feature flag gating for portal-specific read routes
// (REQ-080, REQ-092 / F-FLAG-01). The flag name "DISABLE_PORTAL" implies
// full portal disablement, not "Next.js portal only". The portal-specific
// read routes below (identity, logos, typography, guidelines) are the
// API surface the public portal consumes; with the flag set they must
// return 404 so an attacker who knows the Express port (8096) cannot
// scrape brand data even if the Next.js layer is disabled.
//
// Routes that REMAIN mounted when DISABLE_PORTAL=1:
//   - GET  /api/brands                       (admin brand list)
//   - GET  /api/brands/:slug                 (admin brand detail)
//   - GET  /api/brands/:slug/colors          (admin color editor reads)
//   - GET  /api/brands/:slug/fonts           (admin font editor reads)
//   - GET  /api/brands/:slug/css-variables   (admin preview CSS)
//   - GET  /api/brands/:slug/assets          (admin asset manager reads)
//   - POST   /api/brands/:slug/logos         (admin logo upload)
//   - DELETE /api/brands/:slug/logos/:key    (admin logo delete)
//   - PUT    /api/brands/:slug/guidelines    (admin guidelines write)
//   - POST /api/brands, PUT /api/brands/:slug, DELETE /api/brands/:slug
//
// Portal-specific read routes that return 404 when DISABLE_PORTAL=1:
//   - GET /api/brands/:slug/identity
//   - GET /api/brands/:slug/logos
//   - GET /api/brands/:slug/typography
//   - GET /api/brands/:slug/guidelines
app.use("/api/brands", disablePortalGate);
app.use("/api/brands", brandsRouter);
app.use("/api/import", importRouter);
app.use("/api/assets", assetsRouter);
// Icons routes — gated by DISABLE_ICONS feature flag (SPEC-014 wiring;
// flag reserved here per SPEC-003 acceptance criteria).
if (process.env.DISABLE_ICONS !== "1") {
  app.use("/api/icons", iconsRouter);
}

// 404 handler for unmatched API routes
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Validate API key configuration at startup
validateApiKeyConfig();

// Build indexes on startup, then start the server
console.log(`[server] Building template index from ${TEMPLATES_DIR}...`);
buildIndex(TEMPLATES_DIR);
console.log(`[server] Building brand index from ${BRANDS_DIR}...`);
buildBrandIndex(BRANDS_DIR);

// Icon index load is async — fail-open on missing dir (iconIndex handles it).
if (process.env.DISABLE_ICONS !== "1") {
  console.log(`[server] Loading icon index from ${ICONS_DIR}...`);
  loadIconIndex(ICONS_DIR).catch((err) => {
    console.error(`[server] Failed to load icon index:`, err);
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Design Library API running on http://0.0.0.0:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/api/health`);
});

export default app;
