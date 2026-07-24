/**
 * Component registry API (SPEC-005).
 *
 * Registry-driven surface that replaces the pre-SPEC-005 static Reshaped
 * manifest. The route handlers query `componentIndex` which is backed by
 * `src/components/registry.json` — the single source of truth generated
 * by `scripts/generate-registry.ts` from TSX sources + registry-meta.yaml.
 *
 * Endpoints:
 *   GET /api/components                  → { items, total }   REQ-037
 *   GET /api/components/:name            → ComponentSpec      REQ-038
 *   GET /api/components/:name/preview    → static HTML        REQ-039
 *
 * Rollback (SPEC-014): if `DISABLE_ENRICHED_COMPONENTS=1`, `GET /api/components`
 * returns the legacy static-manifest shape (`{ count, components: [...] }`)
 * with the original 14 Reshaped entries. The `:name` and `/preview` routes
 * are unaffected (they were not part of the legacy surface).
 *
 * CISO guards:
 *   - No POST /preview variant — the original spec considered a "render
 *     arbitrary code" path; we explicitly do NOT add one (REQ-039, CISO
 *     F-COMP-RCE-01).
 *   - Preview response always has strict CSP and `Cache-Control: no-cache`.
 *   - 404 shape normalized to `{ error, name }` per REQ-079.
 */

import { Router, Request, Response } from "express";
import { publicAccess } from "../middleware/auth";
import { getDefaultComponentIndex } from "../lib/componentIndex";
import type { ComponentSpec } from "../../../lib/types/api";

const router = Router();

// ─── Legacy rollback manifest (SPEC-014) ────────────────────────────────────
//
// Preserved exactly as it shipped pre-SPEC-005 so any caller that explicitly
// opts in with `DISABLE_ENRICHED_COMPONENTS=1` continues to work.

const LEGACY_STORYBOOK_BASE = "http://localhost:8095";
const LEGACY_DOCS_BASE = "https://reshaped.so/docs/components";

interface LegacyComponentEntry {
  name: string;
  description: string;
  storybookUrl: string;
  docsUrl: string;
  variants: string[];
}

const LEGACY_COMPONENT_MANIFEST: LegacyComponentEntry[] = [
  {
    name: "Button",
    description:
      "Interactive button with solid, outline, ghost, and faded variants. Supports groups, icons, loading state.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-button`,
    docsUrl: `${LEGACY_DOCS_BASE}/button`,
    variants: ["solid", "outline", "ghost", "faded"],
  },
  {
    name: "Card",
    description:
      "Container component with elevated and outlined variants. Supports custom padding and nested layouts.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-card`,
    docsUrl: `${LEGACY_DOCS_BASE}/card`,
    variants: ["elevated", "outlined"],
  },
  {
    name: "Text",
    description:
      "Typography component covering title, body, and caption scales with weight and color options.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-text`,
    docsUrl: `${LEGACY_DOCS_BASE}/text`,
    variants: [
      "title-1",
      "title-2",
      "title-3",
      "title-4",
      "title-5",
      "title-6",
      "body-1",
      "body-2",
      "body-3",
      "caption-1",
      "caption-2",
    ],
  },
  {
    name: "Alert",
    description:
      "Feedback component for messages with neutral, positive, warning, and critical color options.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-alert`,
    docsUrl: `${LEGACY_DOCS_BASE}/alert`,
    variants: ["neutral", "primary", "positive", "warning", "critical"],
  },
  {
    name: "Avatar",
    description:
      "User representation with image, initials fallback, multiple sizes, and squared option.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-avatar`,
    docsUrl: `${LEGACY_DOCS_BASE}/avatar`,
    variants: ["circular", "squared"],
  },
  {
    name: "Badge",
    description:
      "Label component for status indicators with solid, faded, and outline variants.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-badge`,
    docsUrl: `${LEGACY_DOCS_BASE}/badge`,
    variants: ["solid", "faded", "outline"],
  },
  {
    name: "Tabs",
    description:
      "Navigation component with line, pills, and pills-elevated variants. Supports controlled state and icons.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-tabs`,
    docsUrl: `${LEGACY_DOCS_BASE}/tabs`,
    variants: ["line", "pills", "pills-elevated"],
  },
  {
    name: "Modal",
    description:
      "Dialog overlay with title, subtitle, body, and footer sections. Supports small, medium, and large sizes.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-modal`,
    docsUrl: `${LEGACY_DOCS_BASE}/modal`,
    variants: ["small", "medium", "large"],
  },
  {
    name: "Table",
    description:
      "Data display with head, body, row, cell, and heading sub-components. Structured tabular layouts.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-table`,
    docsUrl: `${LEGACY_DOCS_BASE}/table`,
    variants: ["default"],
  },
  {
    name: "TextField",
    description:
      "Text input with outline, faded, and headless variants. Supports start/end slots, multiline, and error state.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-textfield`,
    docsUrl: `${LEGACY_DOCS_BASE}/text-field`,
    variants: ["outline", "faded", "headless"],
  },
  {
    name: "Select",
    description:
      "Dropdown selection component with options array, placeholder, and size variants.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-select`,
    docsUrl: `${LEGACY_DOCS_BASE}/select`,
    variants: ["small", "medium", "large"],
  },
  {
    name: "Switch",
    description:
      "Toggle component for boolean settings with label support and controlled/uncontrolled modes.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-switch`,
    docsUrl: `${LEGACY_DOCS_BASE}/switch`,
    variants: ["default", "disabled"],
  },
  {
    name: "Tooltip",
    description:
      "Hover overlay providing contextual information. Positions: top, bottom, start, end.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-tooltip`,
    docsUrl: `${LEGACY_DOCS_BASE}/tooltip`,
    variants: ["top", "bottom", "start", "end"],
  },
  {
    name: "Loader",
    description:
      "Spinning loading indicator with small, medium, and large sizes.",
    storybookUrl: `${LEGACY_STORYBOOK_BASE}/?path=/story/components-loader`,
    docsUrl: `${LEGACY_DOCS_BASE}/loader`,
    variants: ["small", "medium", "large"],
  },
];

// ─── Validation helpers ─────────────────────────────────────────────────────

const VALID_TIERS = ["ui", "primitives", "features", "effects"] as const;
type Tier = (typeof VALID_TIERS)[number];

function isTier(value: unknown): value is Tier {
  return (
    typeof value === "string" &&
    (VALID_TIERS as readonly string[]).includes(value)
  );
}

/**
 * Component-name validation.
 * Alphanumerics, dashes, underscores only. 1–80 chars. Blocks path
 * traversal (`.`, `..`, `/`, `\`) and URL-encoded variants.
 */
const NAME_RE = /^[A-Za-z0-9_-]+$/;
function validateComponentName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 80 &&
    NAME_RE.test(name)
  );
}

/** Resolve the current legacy-mode flag at request time (testability). */
function isLegacyMode(): boolean {
  return process.env.DISABLE_ENRICHED_COMPONENTS === "1";
}

// ─── Preview renderer ───────────────────────────────────────────────────────

/** HTML-escape untrusted text for safe insertion into a preview document. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a static, self-contained HTML preview for a component using the
 * default props derived from its examples / variants. No arbitrary user
 * code is executed; the preview is a read-only snapshot document.
 */
function renderPreviewHtml(spec: ComponentSpec): string {
  const title = escapeHtml(spec.name);
  const tier = escapeHtml(spec.tier);
  const description = escapeHtml(
    spec.description ?? "No description available.",
  );
  const path = escapeHtml(spec.path);

  const variantRows = spec.variants
    ? Object.entries(spec.variants)
        .map(([group, keys]) => {
          const groupEsc = escapeHtml(group);
          const items = keys
            .map((k) => `<code>${escapeHtml(k)}</code>`)
            .join(", ");
          return `<tr><th scope="row">${groupEsc}</th><td>${items}</td></tr>`;
        })
        .join("")
    : "";

  const exampleBlocks = (spec.examples ?? [])
    .map((ex) => {
      const label = escapeHtml(ex.label);
      const code = escapeHtml(ex.code);
      return `<section><h3>${label}</h3><pre><code>${code}</code></pre></section>`;
    })
    .join("");

  const propsRows = (spec.props ?? [])
    .map((p) => {
      const name = escapeHtml(p.name);
      const type = escapeHtml(p.type);
      const opt = p.optional ? "optional" : "required";
      const def =
        p.default !== undefined
          ? escapeHtml(typeof p.default === "string" ? p.default : JSON.stringify(p.default))
          : "—";
      const desc = escapeHtml(p.description ?? "");
      return `<tr><td><code>${name}</code></td><td><code>${type}</code></td><td>${opt}</td><td><code>${def}</code></td><td>${desc}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} — Component Preview</title>
    <style>
      :root { color-scheme: light dark; }
      body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 2rem; max-width: 72ch; }
      header { border-bottom: 1px solid #ccc; padding-bottom: .75rem; margin-bottom: 1.25rem; }
      h1 { margin: 0 0 .25rem 0; font-size: 1.5rem; }
      .tier { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: #888; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { border: 1px solid #ddd; padding: .4rem .6rem; text-align: left; vertical-align: top; }
      pre { background: #f6f8fa; padding: .75rem; border-radius: 6px; overflow-x: auto; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      section { margin: 1rem 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>${title}</h1>
      <div class="tier">${tier} · <code>${path}</code></div>
      <p>${description}</p>
    </header>
    ${variantRows ? `<section><h2>Variants</h2><table><tbody>${variantRows}</tbody></table></section>` : ""}
    ${propsRows ? `<section><h2>Props</h2><table><thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Default</th><th>Description</th></tr></thead><tbody>${propsRows}</tbody></table></section>` : ""}
    ${exampleBlocks ? `<section><h2>Examples</h2>${exampleBlocks}</section>` : ""}
  </body>
</html>`;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/components
 *
 * New shape: `{ items: ComponentSpec[], total: number }`.
 * Supports `?q=<substring>` and `?tier=<ui|primitives|features|effects>`.
 *
 * Legacy shape (flag=DISABLE_ENRICHED_COMPONENTS=1): `{ count, components[] }`
 * matching the pre-SPEC-005 Reshaped manifest exactly.
 */
router.get("/", publicAccess, (req: Request, res: Response) => {
  // Rollback shortcut — ignore query params and return the frozen manifest.
  if (isLegacyMode()) {
    res.json({
      count: LEGACY_COMPONENT_MANIFEST.length,
      components: LEGACY_COMPONENT_MANIFEST,
    });
    return;
  }

  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const tierRaw =
    typeof req.query.tier === "string" ? req.query.tier : undefined;

  if (tierRaw !== undefined && !isTier(tierRaw)) {
    res.status(400).json({
      error: "Invalid tier",
      valid: [...VALID_TIERS],
    });
    return;
  }

  const index = getDefaultComponentIndex();
  const items = index.search({ q, tier: tierRaw });
  res.json({ items, total: items.length });
});

/**
 * GET /api/components/:name
 *
 * Returns the full `ComponentSpec`. 404 for unknown names with normalized
 * `{ error, name }` shape (REQ-079).
 */
router.get("/:name", publicAccess, (req: Request, res: Response) => {
  const { name } = req.params;

  if (!validateComponentName(name)) {
    res.status(400).json({
      error: "Invalid component name",
      name: typeof name === "string" ? name : "",
    });
    return;
  }

  const index = getDefaultComponentIndex();
  const spec = index.get(name);
  if (!spec) {
    res.status(404).json({ error: "Component not found", name });
    return;
  }
  res.json(spec);
});

/**
 * GET /api/components/:name/preview
 *
 * Returns a static, self-contained HTML document previewing the component.
 * NEVER executes arbitrary code — the HTML is rendered from the registry
 * metadata only (name, variants, props, examples).
 *
 * Security headers: strict CSP (default-src 'self'), `Cache-Control: no-cache`,
 * and `X-Content-Type-Options: nosniff`.
 *
 * We do NOT expose a POST variant — CISO F-COMP-RCE-01 forbids user-supplied
 * code reaching a renderer.
 */
router.get(
  "/:name/preview",
  publicAccess,
  (req: Request, res: Response) => {
    const { name } = req.params;

    if (!validateComponentName(name)) {
      res.status(400).json({
        error: "Invalid component name",
        name: typeof name === "string" ? name : "",
      });
      return;
    }

    const index = getDefaultComponentIndex();
    const spec = index.get(name);
    if (!spec) {
      res.status(404).json({ error: "Component not found", name });
      return;
    }

    const html = renderPreviewHtml(spec);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // SPEC-008 REQ-022 — allow framing from the Next.js admin. The
    // browser-visible origin is the host-mapped Next.js port (e.g.
    // http://localhost:8083 + http://127.0.0.1:8083), NOT the
    // container-internal 8095. CORS_ORIGIN already holds the correct
    // comma-separated list. Mirrors src/api/server.ts /preview mount.
    const frameAncestors = (process.env.CORS_ORIGIN || "http://localhost:8095")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' ${frameAncestors}`,
    );
    res.removeHeader("X-Frame-Options");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(html);
  },
);

export default router;
