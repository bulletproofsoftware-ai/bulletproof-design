/**
 * Shared API types — consumed by both the Express API (src/api/**) and the
 * Next.js app (app/**, components/**, lib/**).
 *
 * The tsconfig excludes src/api from the Next.js compilation, so anything the
 * client imports from the server must be re-exported through this file.
 *
 * Single Source of Truth (SSoT) — `lib/api.ts` MUST import its types from
 * here (and `lib/types/brand.ts`) and MUST NOT import from `src/api/**`.
 * Doing so would break the Next.js build because `src/api` is excluded from
 * the Next.js compilation boundary. The boundary is enforced at test time
 * by `__tests__/lib-api-boundary.test.ts` (REQ-062).
 *
 * Introduced by SPEC-002 (guidelines parser). Expanded by SPEC-010.
 */

import type {
  Logos,
  LogoEntry,
  Typography,
  FlatColors,
  RoleGroupedColors,
} from "./brand";

/**
 * A single top-level section of a brand guidelines document, keyed by a
 * slug derived from the H2 heading.
 *
 * `body` is rendered HTML (markdown-it → sanitize-html allowlist) when the
 * parser runs with `renderHtml: true` (default). In `renderHtml: false` mode
 * `body` equals `bodyMarkdown` so callers get a single predictable shape.
 *
 * `bodyMarkdown` always contains the raw Markdown for the section minus the
 * H2 heading line and minus the Do's / Don'ts sub-lists (those are extracted
 * into `dos` / `donts`).
 */
export interface GuidelinesSection {
  slug: string;
  title: string;
  body: string;
  bodyMarkdown: string;
  dos: string[];
  donts: string[];
}

/**
 * Parsed guidelines document.
 *
 * - `meta` is the raw YAML frontmatter (empty object when missing/malformed).
 * - `declaredSections` echoes any `sections: [{slug,title}]` array found in
 *   frontmatter. Optional — the parser treats the body H2s as ground truth,
 *   but surfaces declared sections so admins can diff their intent against
 *   the actual output.
 * - `warnings` is a list of non-fatal conditions the parser encountered
 *   (empty input, malformed frontmatter, declared section missing from body,
 *   etc.). Callers can surface these in the admin UI without failing.
 */
export interface ParsedGuidelines {
  meta: Record<string, unknown>;
  declaredSections?: Array<{ slug: string; title: string }>;
  sections: GuidelinesSection[];
  warnings: string[];
}

// ─── Component registry (SPEC-005) ───────────────────────────────────────────
//
// Atomic response-shape migration point (REQ-069) — consumed by both the
// Express API (src/api/routes/components.ts) and the Next.js app via lib/api.ts.

/** One extracted prop on a component (REQ-019). */
export interface ComponentProp {
  name: string;
  type: string;
  /** Optional marker — `true` when the prop is declared with `?:` in TS. */
  optional?: boolean;
  /** Default value from a destructuring default, as TS source text. */
  default?: unknown;
  /** JSDoc description extracted from the prop declaration. */
  description?: string;
}

/** CVA variant group → ordered list of variant keys. */
export type ComponentVariants = Record<string, string[]>;

/** Usage guidance (REQ-018). */
export interface ComponentGuidelines {
  when?: string;
  whenNot?: string;
  notes?: string;
}

/** Accessibility notes for a component. */
export interface ComponentAccessibility {
  role?: string;
  keyboard?: string[];
  notes?: string;
}

/** Curated usage example. */
export interface ComponentExample {
  label: string;
  code: string;
  description?: string;
}

/**
 * Full component spec returned by `GET /api/components/:name` and included in
 * `GET /api/components` list responses (REQ-037, REQ-038, REQ-069).
 */
export interface ComponentSpec {
  name: string;
  tier: "ui" | "primitives" | "features" | "effects";
  path: string;
  client: boolean;
  description?: string;
  guidelines?: ComponentGuidelines;
  props?: ComponentProp[];
  variants?: ComponentVariants;
  dependencies?: string[];
  examples?: ComponentExample[];
  accessibility?: ComponentAccessibility;
  /** True when the component has no matching entry in `registry-meta.yaml`. */
  incomplete?: boolean;
}

/** Response shape for `GET /api/components` (REQ-037). */
export interface ComponentListResponse {
  items: ComponentSpec[];
  total: number;
}

/** Error shape returned for unknown component names (REQ-079). */
export interface ComponentNotFoundError {
  error: string;
  name: string;
}

/**
 * Legacy shape preserved behind `DISABLE_ENRICHED_COMPONENTS=1` feature flag.
 * Matches the pre-SPEC-005 static Reshaped manifest response. Do not use for
 * new code — kept only for rollback compatibility (SPEC-014).
 */
export interface LegacyComponentManifestResponse {
  count: number;
  components: Array<{
    name: string;
    description: string;
    storybookUrl: string;
    docsUrl: string;
    variants: string[];
  }>;
}

// ─── Icons (SPEC-003 / SPEC-009) ─────────────────────────────────────────────
//
// SSoT for icon metadata returned by `GET /api/icons*`. `lib/api.ts` re-exports
// these under the names `IconMetadata` / `IconsListResponse` for back-compat
// with existing consumers; `IconMeta` / `IconList` are the canonical names.

/** Available Material Symbols style for each icon. */
export type IconStyle = "outlined" | "rounded" | "sharp";

/** One icon's metadata — shared list + detail shape. */
export interface IconMeta {
  name: string;
  category: string;
  tags: string[];
  aliases: string[];
  styles: IconStyle[];
  /** Present on detail responses; styles actually present on disk. */
  availableStyles?: IconStyle[];
}

/**
 * Preferred alias for `IconMeta` — matches the naming that existed before
 * SPEC-010 consolidation. Kept as a type alias so both names resolve to the
 * same structural type.
 */
export type IconMetadata = IconMeta;

/** Paginated response shape for `GET /api/icons`. */
export interface IconList {
  items: IconMeta[];
  total: number;
  page: number;
  limit: number;
}

/** Alias for `IconList` — previously named `IconsListResponse`. */
export type IconsListResponse = IconList;

/** One row of `GET /api/icons/categories`. */
export interface IconsCategory {
  category: string;
  count: number;
}

/** Query params accepted by the icons list endpoint. */
export interface IconsListParams {
  q?: string;
  style?: IconStyle;
  category?: string;
  page?: number;
  /** 0 returns the full filtered set — used by the browser UI. */
  limit?: number;
}

// ─── Brand portal responses (SPEC-004 / SPEC-006) ────────────────────────────
//
// Response shapes for the SPEC-004 identity/logos/typography endpoints plus
// the list of brand assets returned by `/api/brands/:slug/assets`. Kept here
// so both the Express API (src/api/**) and Next.js client (lib/api.ts) agree
// on a single structural definition without the client importing from
// src/api (forbidden by the Next.js compilation boundary).

/** Logo entry with its resolved static URL (added by the API). */
export type LogoEntryWithUrl = LogoEntry & { url: string };

/** Server-expanded logos map — keys match `Logos` plus a resolved URL. */
export type LogosWithUrls = Partial<Record<keyof Logos, LogoEntryWithUrl>>;

/** Response from `GET /api/brands/:slug/identity` (REQ-030). */
export interface BrandIdentityResponse {
  slug: string;
  colors: FlatColors | RoleGroupedColors;
  typography: Typography | null;
  logos: LogosWithUrls;
}

/** Response from `GET /api/brands/:slug/logos` (REQ-031). */
export interface BrandLogosResponse {
  slug: string;
  logos: LogosWithUrls;
}

/** Response from `GET /api/brands/:slug/typography` (REQ-032). */
export interface BrandTypographyResponse {
  slug: string;
  typography: Typography | null;
}

/** Response from `GET /api/brands/:slug/colors`. */
export interface BrandColorsResponse {
  slug: string;
  colors: FlatColors | RoleGroupedColors;
  shape: "role-grouped" | "flat";
}

/**
 * Response from `GET /api/brands/:slug/assets`. `assets` maps an asset key to
 * a URL; `logos` is only present when the brand is stored in directory format
 * (REQ-004).
 */
export interface BrandAssetsResponse {
  slug: string;
  assets: Record<string, string>;
  logos?: Logos;
}

/**
 * Response from `GET /api/brands/:slug/guidelines` (default, JSON). Raw
 * (text/markdown) variant is handled separately — `getGuidelinesRaw` returns
 * a `string`.
 */
export type BrandGuidelinesResponse = ParsedGuidelines;

// ─── Normalized error body (REQ-079) ─────────────────────────────────────────
//
// Canonical error envelope emitted by every API route handler. Fields beyond
// `error` are context-specific and always optional — the client reads them
// opportunistically to render better error messages.

export interface ApiErrorBody {
  error: string;
  slug?: string;
  name?: string;
  key?: string;
  file?: string;
  style?: string;
  category?: string;
}
