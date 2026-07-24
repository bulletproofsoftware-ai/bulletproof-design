/**
 * MCP Server for the Design System.
 *
 * Exposes 10 read-only tools that wrap the component registry, asset registry,
 * design tokens, brand configs, brand guidelines, and the Material Symbols
 * icon library.
 *
 * Legacy tools (REQ-044):
 *   1. get_component
 *   2. search_components
 *   3. get_asset
 *   4. get_tokens
 *   5. get_composition_rules
 *
 * New tools (REQ-045..REQ-049):
 *   6. get_brand_identity
 *   7. get_brand_guidelines
 *   8. get_component_spec
 *   9. search_icons
 *   10. get_icon
 *
 * Run: npx tsx src/mcp/design-system-server.ts
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

import {
  buildBrandIndex,
  getBySlug as getBrandBySlug,
} from "../api/lib/brandIndex.js";
import { parseGuidelines } from "../api/lib/guidelinesParser.js";
import {
  loadIconIndex,
  type IconIndex,
} from "../api/lib/iconIndex.js";
import {
  createComponentIndex,
  type ComponentIndex,
} from "../api/lib/componentIndex.js";

// ---------------------------------------------------------------------------
// Paths — always resolve from project root, not CWD
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..", "..");

const COMPONENT_REGISTRY = resolve(PROJECT_ROOT, "src/components/registry.json");
const ASSET_REGISTRY = resolve(PROJECT_ROOT, "src/assets/registry.json");
const TOKENS_BASE = resolve(PROJECT_ROOT, "design-tokens/tokens.json");
const THEMES_DIR = resolve(PROJECT_ROOT, "design-tokens/themes");

/** Source directories for brand configs and icons. Overridable via env vars. */
const BRANDS_DIR = resolve(PROJECT_ROOT, process.env.BRANDS_DIR ?? "brands");
const ICONS_DIR = resolve(
  PROJECT_ROOT,
  process.env.ICONS_DIR ?? "icons/material-symbols",
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComponentEntry {
  name: string;
  tier: string;
  path: string;
  client?: boolean;
  description?: string;
  variants?: Record<string, string[]>;
  props?: Array<{ name: string; type: string }>;
  dependencies?: string[];
  examples?: Array<{ label: string; code: string }>;
  accessibility?: Record<string, unknown>;
}

interface AssetEntry {
  name: string;
  file: string;
  category: string;
  format: string;
  size: string;
  tags: string[];
  usage: string;
}

type TokenValue = { $value: string; $type: string };
type TokenCategory = Record<string, TokenValue>;
type TokenFile = Record<string, TokenCategory>;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/** Matches kebab-case brand slugs (also allows digits). */
const BRAND_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Matches Material Symbols icon names. */
const ICON_NAME_RE = /^[a-z0-9_]{1,128}$/;
/** Matches guidelines section slugs (alphanumeric, dashes, underscores). */
const SECTION_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Format a handler error response in the MCP text-content shape.
 * We intentionally do NOT set `isError: true` on the returned object — the
 * existing five legacy handlers return plain text error messages via the
 * same `{ content: [...] }` shape and are checked via text matching in the
 * tests. For the new handlers we embed a JSON error payload so callers can
 * parse it deterministically. The shape stays `{ content: [...] }` for
 * compatibility with the legacy tools' response type.
 */
function errorResponse(
  payload: Record<string, unknown>,
): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function successResponse(
  payload: unknown,
): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Index singletons — lazily initialized on first handler call
// ---------------------------------------------------------------------------

let brandIndexLoaded = false;
function ensureBrandIndex(): void {
  if (brandIndexLoaded) return;
  try {
    buildBrandIndex(BRANDS_DIR);
    brandIndexLoaded = true;
  } catch (err) {
    // Keep flag false so next call retries — but log so tests can see it.
    console.warn(
      `[mcp] buildBrandIndex failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

let iconIndexInstance: IconIndex | undefined;
async function ensureIconIndex(): Promise<IconIndex> {
  if (iconIndexInstance) return iconIndexInstance;
  iconIndexInstance = await loadIconIndex(ICONS_DIR);
  return iconIndexInstance;
}

let componentIndexInstance: ComponentIndex | undefined;
function ensureComponentIndex(): ComponentIndex {
  if (componentIndexInstance) return componentIndexInstance;
  componentIndexInstance = createComponentIndex(COMPONENT_REGISTRY);
  return componentIndexInstance;
}

/** Reset all lazy singletons — test helper only. */
export function __resetMcpIndexesForTests(): void {
  brandIndexLoaded = false;
  iconIndexInstance = undefined;
  componentIndexInstance = undefined;
}

// ---------------------------------------------------------------------------
// Legacy handlers (unchanged — preserved verbatim for REQ-044)
// ---------------------------------------------------------------------------

export async function handleGetComponent(args: {
  name: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const registry = await readJsonFile<{ components: ComponentEntry[] }>(COMPONENT_REGISTRY);
  const match = registry.components.find(
    (c) => c.name.toLowerCase() === args.name.toLowerCase()
  );
  if (!match) {
    return {
      content: [{ type: "text", text: `Component not found: "${args.name}"` }],
    };
  }
  return { content: [{ type: "text", text: JSON.stringify(match, null, 2) }] };
}

export async function handleSearchComponents(args: {
  query: string;
  tier?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const registry = await readJsonFile<{ components: ComponentEntry[] }>(COMPONENT_REGISTRY);
  const q = args.query.toLowerCase();

  let candidates = registry.components;
  if (args.tier) {
    candidates = candidates.filter((c) => c.tier === args.tier);
  }

  // Score: name match = 3, description match = 2, tag/dependency match = 1
  const scored = candidates
    .map((c) => {
      let score = 0;
      if (c.name.toLowerCase().includes(q)) score += 3;
      if (c.description?.toLowerCase().includes(q)) score += 2;
      const deps = c.dependencies ?? [];
      if (deps.some((d) => d.toLowerCase().includes(q))) score += 1;
      return { component: c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.component);

  return {
    content: [{ type: "text", text: JSON.stringify(scored, null, 2) }],
  };
}

export async function handleGetAsset(args: {
  name: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const registry = await readJsonFile<{ assets: AssetEntry[] }>(ASSET_REGISTRY);
  const match = registry.assets.find(
    (a) => a.name.toLowerCase() === args.name.toLowerCase()
  );
  if (!match) {
    return {
      content: [{ type: "text", text: `Asset not found: "${args.name}"` }],
    };
  }
  return { content: [{ type: "text", text: JSON.stringify(match, null, 2) }] };
}

export async function handleGetTokens(args: {
  category?: string;
  theme?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let tokens: TokenFile;
  try {
    tokens = await readJsonFile<TokenFile>(TOKENS_BASE);
  } catch {
    return {
      content: [{ type: "text", text: "Error: could not read base tokens file" }],
    };
  }

  // Merge theme overrides if requested
  if (args.theme) {
    const themePath = resolve(THEMES_DIR, `${args.theme}.json`);
    // Path containment check — ensure resolved path stays within THEMES_DIR
    if (!themePath.startsWith(THEMES_DIR)) {
      return {
        content: [{ type: "text", text: "Error: invalid theme path" }],
      };
    }
    try {
      const themeTokens = await readJsonFile<TokenFile>(themePath);
      for (const [cat, values] of Object.entries(themeTokens)) {
        tokens[cat] = { ...tokens[cat], ...values };
      }
    } catch {
      return {
        content: [
          { type: "text", text: `Theme not found: "${args.theme}"` },
        ],
      };
    }
  }

  // Filter to category if specified
  if (args.category) {
    const cat = tokens[args.category];
    if (!cat) {
      return {
        content: [
          {
            type: "text",
            text: `Category not found: "${args.category}". Available: ${Object.keys(tokens).join(", ")}`,
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ [args.category]: cat }, null, 2) }],
    };
  }

  return { content: [{ type: "text", text: JSON.stringify(tokens, null, 2) }] };
}

const COMPOSITION_RULES: Record<string, string> = {
  ui: "External packages only",
  primitives: "ui/, external packages",
  features:
    "primitives/, ui/, external packages. Cannot import from other features.",
  effects: "ui/, external packages",
};

export async function handleGetCompositionRules(args: {
  tier: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const rule = COMPOSITION_RULES[args.tier.toLowerCase()];
  if (!rule) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tier: "${args.tier}". Valid tiers: ${Object.keys(COMPOSITION_RULES).join(", ")}`,
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { tier: args.tier.toLowerCase(), allowedImports: rule },
          null,
          2
        ),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// New handlers (REQ-045..REQ-049)
// ---------------------------------------------------------------------------

/**
 * REQ-045 — Return a brand's visual identity (colors, typography, logos).
 *
 * `typography` is whatever the brand stored (structured Typography or undefined).
 * `logos` includes both the new `logos` object and the legacy `logo` fallback
 * so downstream consumers can render either shape.
 */
export async function handleGetBrandIdentity(args: {
  slug: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (typeof args.slug !== "string" || !BRAND_SLUG_RE.test(args.slug)) {
    return errorResponse({ error: "Invalid brand slug", slug: args.slug });
  }
  ensureBrandIndex();
  const brand = getBrandBySlug(args.slug);
  if (!brand) {
    return errorResponse({ error: "Brand not found", slug: args.slug });
  }
  return successResponse({
    slug: brand.slug,
    name: brand.name,
    colors: brand.colors,
    typography: brand.typography ?? null,
    logos: brand.logos ?? brand.logo ?? {},
    fonts: brand.fonts ?? null,
  });
}

/**
 * REQ-046 — Return parsed brand guidelines, optionally filtered to one section.
 *
 * Reads `brands/<slug>/guidelines.md` from disk. Returns parsed sections
 * (title, slug, markdown body, dos/donts). Rendered HTML is omitted
 * (renderHtml: false) since MCP clients rarely need it and raw markdown is
 * more composable.
 */
export async function handleGetBrandGuidelines(args: {
  slug: string;
  section?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (typeof args.slug !== "string" || !BRAND_SLUG_RE.test(args.slug)) {
    return errorResponse({ error: "Invalid brand slug", slug: args.slug });
  }
  if (
    typeof args.section !== "undefined"
    && (typeof args.section !== "string" || !SECTION_SLUG_RE.test(args.section))
  ) {
    return errorResponse({
      error: "Invalid section slug",
      slug: args.slug,
      section: args.section,
    });
  }

  // Path is constructed from validated slug; join() cannot escape BRANDS_DIR
  // because the slug regex forbids `/`, `\`, `.`, and other traversal chars.
  const filePath = join(BRANDS_DIR, args.slug, "guidelines.md");
  if (!filePath.startsWith(BRANDS_DIR)) {
    return errorResponse({ error: "Invalid path", slug: args.slug });
  }
  if (!existsSync(filePath)) {
    return errorResponse({
      error: "guidelines.md not found",
      slug: args.slug,
    });
  }

  let md: string;
  try {
    md = await readFile(filePath, "utf-8");
  } catch (err) {
    return errorResponse({
      error: "Failed to read guidelines",
      slug: args.slug,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const parsed = parseGuidelines(md, { renderHtml: false });

  if (args.section) {
    const match = parsed.sections.find((s) => s.slug === args.section);
    if (!match) {
      return errorResponse({
        error: "Section not found",
        slug: args.slug,
        section: args.section,
        available: parsed.sections.map((s) => s.slug),
      });
    }
    return successResponse({ slug: args.slug, section: match });
  }

  return successResponse({
    slug: args.slug,
    meta: parsed.meta,
    sections: parsed.sections,
    warnings: parsed.warnings,
  });
}

/**
 * REQ-047 — Return the full enriched component spec (props, variants,
 * guidelines, examples, dependencies, accessibility).
 *
 * Uses componentIndex which layers registry.json with registry-meta.yaml
 * enrichment. Falls back to the raw registry if the enriched path fails.
 */
export async function handleGetComponentSpec(args: {
  name: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (typeof args.name !== "string" || args.name.length === 0 || args.name.length > 128) {
    return errorResponse({ error: "Invalid component name", name: args.name });
  }
  const index = ensureComponentIndex();
  const spec = index.get(args.name);
  if (!spec) {
    return errorResponse({ error: "Component not found", name: args.name });
  }
  return successResponse(spec);
}

/**
 * REQ-048 — Search Material Symbols icons by name/alias/tag.
 *
 * Uses iconIndex.search() which returns a paginated IconSearchResponse.
 * The MCP tool exposes a capped limit (50) to keep responses manageable.
 */
export async function handleSearchIcons(args: {
  query: string;
  style?: string;
  category?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (typeof args.query !== "string") {
    return errorResponse({ error: "Invalid query" });
  }
  if (
    typeof args.style !== "undefined"
    && !["outlined", "rounded", "sharp"].includes(args.style)
  ) {
    return errorResponse({
      error: "Invalid style",
      style: args.style,
      allowed: ["outlined", "rounded", "sharp"],
    });
  }
  const index = await ensureIconIndex();
  const result = index.search({
    q: args.query,
    style: args.style,
    category: args.category,
    limit: 50,
  });
  return successResponse({
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
}

/**
 * REQ-049 — Return the SVG content + metadata for a specific icon.
 *
 * The SVG path is resolved through `iconIndex.svgPath()` which:
 *  - Validates the icon name format.
 *  - Validates the style enum.
 *  - Asserts containment under `ICONS_DIR` (prevents path traversal).
 *
 * So even if an attacker somehow smuggled a crafted name past our regex, the
 * index's own containment check would reject it.
 */
export async function handleGetIcon(args: {
  name: string;
  style?: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (typeof args.name !== "string" || !ICON_NAME_RE.test(args.name)) {
    return errorResponse({ error: "Invalid icon name", name: args.name });
  }
  const style = args.style ?? "outlined";
  if (!["outlined", "rounded", "sharp"].includes(style)) {
    return errorResponse({
      error: "Invalid style",
      style,
      allowed: ["outlined", "rounded", "sharp"],
    });
  }

  const index = await ensureIconIndex();
  const meta = index.get(args.name);
  if (!meta) {
    return errorResponse({ error: "Icon not found", name: args.name });
  }
  if (!meta.styles.includes(style as "outlined" | "rounded" | "sharp")) {
    return errorResponse({
      error: "Style not available for this icon",
      name: args.name,
      style,
      available: meta.styles,
    });
  }

  const svgPath = index.svgPath(args.name, style);
  if (!svgPath) {
    return errorResponse({
      error: "SVG path could not be resolved",
      name: args.name,
      style,
    });
  }

  let svg: string;
  try {
    svg = await readFile(svgPath, "utf-8");
  } catch (err) {
    return errorResponse({
      error: "SVG file could not be read",
      name: args.name,
      style,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return successResponse({
    name: meta.name,
    style,
    category: meta.category,
    tags: meta.tags,
    aliases: meta.aliases,
    availableStyles: meta.styles,
    svg,
  });
}

// ---------------------------------------------------------------------------
// Server setup — only runs when executed directly
// ---------------------------------------------------------------------------

export function createServer(): McpServer {
  const server = new McpServer({
    name: "design-system",
    version: "1.1.0",
  });

  // ─── Legacy tools (REQ-044) ──────────────────────────────────────

  server.registerTool("get_component", {
    description: "Look up a component by name. Returns full registry entry.",
    inputSchema: z.object({
      name: z.string().describe("Component name (case-insensitive)"),
    }),
  }, async (args) => handleGetComponent(args));

  server.registerTool("search_components", {
    description:
      "Search components by query string across name, description, and dependencies. Optionally filter by tier.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      tier: z
        .enum(["ui", "primitives", "features", "effects"])
        .optional()
        .describe("Filter to a specific tier"),
    }),
  }, async (args) => handleSearchComponents(args));

  server.registerTool("get_asset", {
    description: "Look up an asset by name. Returns full registry entry with file path.",
    inputSchema: z.object({
      name: z.string().describe("Asset name (case-insensitive)"),
    }),
  }, async (args) => handleGetAsset(args));

  server.registerTool("get_tokens", {
    description:
      "Retrieve design token values. Optionally filter by category and/or merge a theme.",
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe("Token category (e.g. brand, surface, text, border, status, radius, spacing, shadow, motion)"),
      theme: z
        .enum(["dark", "high-contrast"])
        .optional()
        .describe("Theme name to merge (dark or high-contrast)"),
    }),
  }, async (args) => handleGetTokens(args));

  server.registerTool("get_composition_rules", {
    description:
      "Get the import boundary rules for a given component tier.",
    inputSchema: z.object({
      tier: z
        .enum(["ui", "primitives", "features", "effects"])
        .describe("Component tier"),
    }),
  }, async (args) => handleGetCompositionRules(args));

  // ─── New tools (REQ-045..REQ-049) ────────────────────────────────

  server.registerTool("get_brand_identity", {
    description:
      "Return the full visual identity (colors, typography, logos, fonts) for a brand slug.",
    inputSchema: z.object({
      slug: z
        .string()
        .regex(BRAND_SLUG_RE)
        .describe("Brand slug — kebab-case, alphanumeric"),
    }),
  }, async (args) => handleGetBrandIdentity(args));

  server.registerTool("get_brand_guidelines", {
    description:
      "Return parsed brand guidelines. Optionally filter to a single section by slug.",
    inputSchema: z.object({
      slug: z
        .string()
        .regex(BRAND_SLUG_RE)
        .describe("Brand slug"),
      section: z
        .string()
        .regex(SECTION_SLUG_RE)
        .optional()
        .describe("Section slug (e.g. 'logo-usage')"),
    }),
  }, async (args) => handleGetBrandGuidelines(args));

  server.registerTool("get_component_spec", {
    description:
      "Return the full enriched component spec (props, variants, guidelines, examples, dependencies, accessibility).",
    inputSchema: z.object({
      name: z.string().describe("Component name (case-insensitive)"),
    }),
  }, async (args) => handleGetComponentSpec(args));

  server.registerTool("search_icons", {
    description:
      "Search Material Symbols icons by name/alias/tag. Optional style and category filters.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      style: z
        .enum(["outlined", "rounded", "sharp"])
        .optional()
        .describe("Icon style filter"),
      category: z
        .string()
        .optional()
        .describe("Icon category filter (e.g. 'action', 'social')"),
    }),
  }, async (args) => handleSearchIcons(args));

  server.registerTool("get_icon", {
    description:
      "Return the SVG content and metadata for a specific Material Symbols icon.",
    inputSchema: z.object({
      name: z
        .string()
        .regex(ICON_NAME_RE)
        .describe("Icon name (lowercase letters, digits, underscores)"),
      style: z
        .enum(["outlined", "rounded", "sharp"])
        .default("outlined")
        .describe("Icon style (default: outlined)"),
    }),
  }, async (args) => handleGetIcon(args));

  return server;
}

// Only start the transport when running as a script (not when imported)
const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(__filename);

if (isDirectRun) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
  });
}
