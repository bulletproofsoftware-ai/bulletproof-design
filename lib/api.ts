// ─────────────────────────────────────────────────────────────────────────
// Design Library — Next.js API client (REQ-062).
//
// IMPORTANT BOUNDARY RULE
// -----------------------
// This file runs under the Next.js compilation boundary, which EXCLUDES
// `src/api/**` (see tsconfig.json → `"exclude": ["src/api"]`). Types shared
// with the Express API therefore MUST be imported from `@/lib/types/api`
// (and `@/lib/types/brand`) — NEVER from `@/src/api/**` or any `src/api/`
// relative path. The boundary is enforced as a test in
// `__tests__/lib-api-boundary.test.ts`.
// ─────────────────────────────────────────────────────────────────────────

// All shared API types live in `lib/types/api.ts` (SSoT). Consolidated type
// imports + re-exports keep this file's dependency surface obvious and
// satisfy the `import/no-duplicates` lint rule.
import type {
  ApiErrorBody,
  BrandIdentityResponse,
  BrandLogosResponse,
  BrandTypographyResponse,
  BrandColorsResponse,
  ComponentSpec,
  ComponentListResponse,
  ParsedGuidelines,
  IconStyle as _IconStyle,
  IconMeta as _IconMeta,
  IconMetadata as _IconMetadata,
  IconList as _IconList,
  IconsListResponse as _IconsListResponse,
  IconsCategory as _IconsCategory,
  IconsListParams as _IconsListParams,
} from "./types/api";

// Re-export shared API types for portal/editor consumers — callers import
// from "@/lib/api" to get both the helpers and the types from one surface.
export type {
  ApiErrorBody,
  BrandIdentityResponse,
  BrandLogosResponse,
  BrandTypographyResponse,
  BrandColorsResponse,
  BrandGuidelinesResponse,
  ComponentSpec,
  ComponentListResponse,
  ComponentProp,
  ComponentVariants,
  ComponentGuidelines,
  ComponentAccessibility,
  ComponentExample,
  ComponentNotFoundError,
  LegacyComponentManifestResponse,
  ParsedGuidelines,
  GuidelinesSection,
  LogoEntryWithUrl,
  LogosWithUrls,
} from "./types/api";

// Dual-context API base.
//
// `API_BASE` — used for `fetch()` calls. Server Components run inside the
// Docker container and must reach the API on the container-loopback IPv4
// port 8096 (NOT `localhost`: Alpine resolves `localhost` to IPv6 ::1 first,
// Express binds only to IPv4 → ECONNREFUSED). Client code in the browser
// must reach the API on the host-mapped port carried in
// `NEXT_PUBLIC_API_URL` (inlined at build time).
//
// `PUBLIC_API_BASE` — used for URLs that are SERIALIZED INTO HTML for the
// browser to consume later (iframe src, downloads, image URLs). Even when
// generated server-side, the consumer is the browser, so the value must be
// the browser-facing origin regardless of where the helper was called.
const API_BASE =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://127.0.0.1:8096"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

/**
 * The API requires x-api-key on every write whenever DESIGN_API_KEY is set on
 * the server, and always in production. Individual call sites kept forgetting
 * to pass it — brand create, template save/delete and URL import all issued
 * unauthenticated writes that 401 in any real deployment. Reading the stored
 * key here means a write helper cannot silently omit it.
 *
 * Callers may still pass an explicit key to override the stored one.
 */
const API_KEY_STORAGE = "design-api-key";

function writeHeaders(explicitKey?: string, json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  let key = explicitKey ?? "";
  if (!key && typeof window !== "undefined") {
    try {
      key = window.localStorage.getItem(API_KEY_STORAGE) ?? "";
    } catch {
      /* localStorage unavailable — send without a key and let the API answer */
    }
  }
  if (key) headers["x-api-key"] = key;
  return headers;
}
const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

/**
 * Parse error body from a failed response for consistent error messages.
 *
 * Reads the normalized `ApiErrorBody` envelope (REQ-079). Silently falls
 * back to `fallback` when the response has no JSON body or is malformed —
 * callers always get a usable message string.
 */
async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

// ─── Brands ─────────────────────────────────────────────────────────

export interface BrandSummary {
  name: string;
  slug: string;
  description: string;
  primaryColor: string;
}

export interface BrandLogo {
  mark: string;
  horizontal: string;
  favicon: string;
}

/**
 * Legacy flat color shape. Still returned by the API for any brand
 * stored in flat format (`brands/<slug>.json`).
 */
export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  warning: string;
  success: string;
}

export interface BrandFonts {
  heading: string;
  body: string;
  mono: string;
}

// Re-export the shared union/guards so Next.js components can import a
// single source of truth for the expanded schema.
export type {
  ColorEntry,
  RoleGroupedColors,
  FlatColors,
  Logos,
  LogoEntry,
  Typography,
  TypographyGroup,
  TypographyScaleEntry,
} from "./types/brand";
export { isRoleGroupedColors, extractPrimaryColor } from "./types/brand";

import type {
  FlatColors,
  RoleGroupedColors,
  Logos,
  Typography,
} from "./types/brand";

/**
 * Unified brand configuration returned by `/api/brands/:slug`.
 *
 * `colors` is a *union* — at runtime it may be either `BrandColors`
 * (flat) or `RoleGroupedColors` (expanded). Use `isRoleGroupedColors`
 * to discriminate before rendering.
 */
export interface BrandConfig {
  name: string;
  slug: string;
  description: string;
  /** Legacy logo field — flat brands only. */
  logo?: BrandLogo;
  /** New: logos with usage context — directory brands (REQ-004). */
  logos?: Logos;
  colors: FlatColors | RoleGroupedColors;
  fonts: BrandFonts;
  spacing: { unit: number; scale: number[] };
  borderRadius: { small: string; medium: string; large: string; full: string };
  shadows: { small: string; medium: string; large: string };
  /** New: typography specimens — directory brands (REQ-005). */
  typography?: Typography;
}

export async function getBrands(): Promise<BrandSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/brands`);
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to fetch brands"));
    const data = await res.json();
    return data.brands;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getBrand(slug: string): Promise<BrandConfig> {
  try {
    const res = await fetch(`${API_BASE}/api/brands/${slug}`);
    if (!res.ok) throw new Error(await parseApiError(res, `Failed to fetch brand: ${slug}`));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getBrandAssets(
  slug: string
): Promise<{ slug: string; assets: Record<string, string> }> {
  try {
    const res = await fetch(`${API_BASE}/api/brands/${slug}/assets`);
    if (!res.ok) throw new Error(await parseApiError(res, `Failed to fetch brand assets: ${slug}`));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function createBrand(brand: BrandConfig, apiKey?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/brands`, {
      method: "POST",
      headers: writeHeaders(apiKey),
      body: JSON.stringify(brand),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to create brand"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function updateBrand(
  slug: string,
  brand: BrandConfig,
  apiKey?: string
): Promise<any> {
  try {
    const headers = writeHeaders(apiKey);
    const res = await fetch(`${API_BASE}/api/brands/${slug}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(brand),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to update brand"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function deleteBrand(slug: string, apiKey?: string): Promise<any> {
  try {
    const headers = writeHeaders(apiKey, false);
    const res = await fetch(`${API_BASE}/api/brands/${slug}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to delete brand"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Categories ─────────────────────────────────────────────────────

export interface Category {
  name: string;
  count: number;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to fetch categories"));
    const data = await res.json();
    return data.categories;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Templates ──────────────────────────────────────────────────────

export interface Template {
  category: string;
  name: string;
  description: string;
  tags: string[];
  source: string;
  filePath: string;
  sourceCode?: string;
}

export async function getTemplates(
  category: string,
  includeSource = false
): Promise<Template[]> {
  try {
    const url = `${API_BASE}/api/templates/${encodeURIComponent(category)}${includeSource ? "?source=true" : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await parseApiError(res, `Failed to fetch templates for ${category}`));
    const data = await res.json();
    return data.templates.map((t: any) => ({ ...t, category: data.category }));
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getTemplate(
  category: string,
  name: string
): Promise<Template> {
  try {
    const res = await fetch(
      `${API_BASE}/api/templates/${encodeURIComponent(category)}/${encodeURIComponent(name)}`
    );
    if (!res.ok) throw new Error(await parseApiError(res, `Failed to fetch template ${category}/${name}`));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function createTemplate(body: {
  category: string;
  name: string;
  description?: string;
  tags?: string[];
  sourceCode: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/templates`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to create template"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function updateTemplate(
  category: string,
  name: string,
  sourceCode: string
): Promise<any> {
  try {
    const res = await fetch(
      `${API_BASE}/api/templates/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: writeHeaders(),
        body: JSON.stringify({ sourceCode }),
      }
    );
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to update template"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function deleteTemplate(
  category: string,
  name: string
): Promise<any> {
  try {
    const res = await fetch(
      `${API_BASE}/api/templates/${encodeURIComponent(category)}/${encodeURIComponent(name)}`,
      { method: "DELETE", headers: writeHeaders(undefined, false) }
    );
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to delete template"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function searchTemplates(query: string): Promise<Template[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error(await parseApiError(res, "Search failed"));
    const data = await res.json();
    return data.results;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Import ─────────────────────────────────────────────────────────

export async function importFromUrl(body: {
  url: string;
  category: string;
  name: string;
  description?: string;
  save?: boolean;
}): Promise<{ status: string; category: string; name: string; sourceCode: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/import`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to import from URL"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Assets ─────────────────────────────────────────────────────────

export interface AssetInfo {
  name: string;
  path: string;
  folder: string;
  size: number;
  url: string;
  mimeType: string;
}

export async function getAssets(folder?: string): Promise<AssetInfo[]> {
  try {
    const url = folder ? `${API_BASE}/api/assets?folder=${encodeURIComponent(folder)}` : `${API_BASE}/api/assets`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to fetch assets"));
    const data = await res.json();
    return (data.assets || []).map((a: any) => ({
      name: a.name,
      path: a.path,
      folder: a.folder,
      size: a.size,
      url: a.url,
      mimeType: a.type || a.mimeType || "application/octet-stream",
    }));
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getAssetFolders(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/assets/folders`);
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to fetch asset folders"));
    const data = await res.json();
    return data.folders;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function uploadAsset(
  folder: string,
  filename: string,
  base64: string
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/assets`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ folder, filename, base64 }),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to upload asset"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function deleteAsset(assetPath: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/api/assets`, {
      method: "DELETE",
      headers: writeHeaders(),
      body: JSON.stringify({ path: assetPath }),
    });
    if (!res.ok) throw new Error(await parseApiError(res, "Failed to delete asset"));
    return await res.json();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Components (SPEC-005) ──────────────────────────────────────────
//
// Registry-driven client surface. Matches REQ-037 / REQ-038 / REQ-069.
// The legacy `{count, components[]}` shape is still returned by the API
// when `DISABLE_ENRICHED_COMPONENTS=1` is set — portal callers should not
// toggle that flag; it exists purely for rollback safety (SPEC-014).
//
// Types (ComponentSpec, ComponentListResponse, etc.) are imported and
// re-exported from `./types/api` at the top of this file.

/**
 * List registered components. Optional `q` substring filter (matches
 * name/description/dependencies) and `tier` exact-match filter.
 *
 * Throws on non-2xx responses — callers are expected to render an error
 * state rather than fall back to an empty list silently.
 */
export async function getComponents(
  params?: { q?: string; tier?: string },
): Promise<ComponentListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.tier) qs.set("tier", params.tier);
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    const res = await fetch(`${API_BASE}/api/components${suffix}`);
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch components (${res.status})`),
      );
    }
    return (await res.json()) as ComponentListResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Fetch the full spec for a single component. Throws on 404 (caller should
 * catch and render a "not found" state) or any other error.
 */
export async function getComponentSpec(name: string): Promise<ComponentSpec> {
  try {
    const res = await fetch(
      `${API_BASE}/api/components/${encodeURIComponent(name)}`,
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch component: ${name}`),
      );
    }
    return (await res.json()) as ComponentSpec;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Build the URL for a component's static HTML preview. Never fetches —
 * returns the URL a caller can drop into an `<iframe src>` or a new tab.
 */
export function getComponentPreviewUrl(name: string): string {
  // PUBLIC_API_BASE: the iframe src lands in the browser, even when this
  // helper is called from a Server Component during SSR.
  return `${PUBLIC_API_BASE}/api/components/${encodeURIComponent(name)}/preview`;
}

/**
 * REQ-062 naming alias for `getComponentPreviewUrl`. Both resolve to the
 * exact same preview URL — this name appears in the BRD acceptance criteria
 * and is provided so callers can use either convention without confusion.
 *
 * Explicitly NOT a POST "run preview" endpoint — there is no server-side
 * component runner (that would be an RCE vector). The interactive
 * playground transpiles JSX client-side via `@babel/standalone` inside a
 * sandboxed srcdoc iframe (SPEC-008).
 */
export function getComponentPreview(name: string): string {
  return getComponentPreviewUrl(name);
}

// ─── Portal (SPEC-006) ──────────────────────────────────────────────
// TODO: SPEC-010 will formalise the typed client surface (pagination,
// variant-scoped preview URLs, etc). Until then these helpers wrap the
// existing `/api/brands/:slug`, `/api/brands/:slug/assets`, and
// `/api/brands/:slug/guidelines` endpoints — SPEC-004 will add dedicated
// `/identity`, `/logos`, `/typography` routes; portal code already reads
// those shapes from the main `/api/brands/:slug` response (which embeds
// them inline when the brand is in directory format).

// (ParsedGuidelines / GuidelinesSection are re-exported alongside the
// Components types above — kept in one place to satisfy import/no-duplicates.)

/**
 * Fetch a brand for portal rendering. Returns `null` instead of throwing
 * when the brand is missing so callers can trigger `notFound()` cleanly.
 *
 * Uses `cache: "no-store"` so the portal always reflects the latest brand
 * config on disk — brand edits show up on the next request with no build.
 */
export async function getBrandForPortal(
  slug: string,
): Promise<BrandConfig | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch brand: ${slug}`),
      );
    }
    return (await res.json()) as BrandConfig;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Brand asset response (from `/api/brands/:slug/assets`).
 *   - `assets` maps an asset key (filename without extension or legacy
 *     logo key) to a URL.
 *   - `logos` is the directory-brand manifest (SPEC-001 REQ-004) — only
 *     present when the brand was loaded in directory format.
 */
export interface BrandAssetsResponse {
  slug: string;
  assets: Record<string, string>;
  logos?: import("./types/brand").Logos;
}

export async function getBrandAssetsForPortal(
  slug: string,
): Promise<BrandAssetsResponse | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/assets`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch assets for ${slug}`),
      );
    }
    return (await res.json()) as BrandAssetsResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Fetch parsed brand guidelines. Returns `null` when the brand has no
 * `guidelines.md` (API returns 404 in that case) — the caller should
 * render an empty-state panel instead of erroring.
 */
export async function getBrandGuidelines(
  slug: string,
): Promise<ParsedGuidelines | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/guidelines`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch guidelines for ${slug}`),
      );
    }
    return (await res.json()) as ParsedGuidelines;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── SPEC-004 portal identity helpers (REQ-062) ─────────────────────
//
// Typed wrappers around the SPEC-004 `/api/brands/:slug/{identity,logos,
// typography,colors}` endpoints. Each returns the raw server envelope
// (`{slug, …}`) so consumers can cross-reference the slug when composing
// UI. Missing brands throw — call `getBrandForPortal(slug)` first when
// `notFound()` behaviour is needed.
//
// Types (BrandIdentityResponse, BrandLogosResponse, BrandTypographyResponse,
// BrandColorsResponse, LogoEntryWithUrl, LogosWithUrls,
// BrandGuidelinesResponse) are imported and re-exported from `./types/api`
// at the top of this file.

/**
 * GET /api/brands/:slug/identity — aggregated visual identity (REQ-030).
 * Throws on non-2xx. Matches the REQ-062 acceptance-criteria naming.
 */
export async function getPortalIdentity(
  slug: string,
): Promise<BrandIdentityResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/identity`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch identity for ${slug}`),
      );
    }
    return (await res.json()) as BrandIdentityResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * GET /api/brands/:slug/logos — resolved logo variants with URLs (REQ-031).
 */
export async function getPortalLogos(
  slug: string,
): Promise<BrandLogosResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/logos`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch logos for ${slug}`),
      );
    }
    return (await res.json()) as BrandLogosResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * GET /api/brands/:slug/typography — typography block or null (REQ-032).
 */
export async function getPortalTypography(
  slug: string,
): Promise<BrandTypographyResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/typography`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch typography for ${slug}`),
      );
    }
    return (await res.json()) as BrandTypographyResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * GET /api/brands/:slug/colors — colors in whatever shape the brand stores
 * (flat or role-grouped) plus the `shape` discriminator.
 */
export async function getPortalColors(
  slug: string,
): Promise<BrandColorsResponse> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/colors`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch colors for ${slug}`),
      );
    }
    return (await res.json()) as BrandColorsResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Alias for `getBrandGuidelines` — matches the REQ-062 acceptance-criteria
 * naming (`getPortalGuidelines`). Kept in parallel with `getBrandGuidelines`
 * so existing SPEC-006 consumers (`app/portal/[slug]/**`) are not touched.
 */
export const getPortalGuidelines = getBrandGuidelines;

// ─── Brand admin editor helpers (SPEC-007) ──────────────────────────
//
// Thin client wrappers around the SPEC-002 guidelines endpoints and the
// SPEC-004 logo upload/delete endpoints. Used by the tabbed brand editor
// at `/brands/[slug]`.
//
// TODO: SPEC-010 will formalise a single typed client surface.

/** Client-side logo upload constraints — mirrors SPEC-004 server limits. */
export const LOGO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_UPLOAD_ALLOWED_MIMES = new Set<string>([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
]);

export type LogoKey = "horizontal" | "vertical" | "icon";

/** Validation result from `validateLogoFile`. */
export interface LogoValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a file before uploading. Returns `{ok: true}` when acceptable,
 * `{ok: false, error}` otherwise. Never throws — safe to call in render
 * paths for disabling a submit button.
 */
export function validateLogoFile(file: File): LogoValidationResult {
  if (file.size > LOGO_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(
        2,
      )} MB). Max is ${LOGO_UPLOAD_MAX_BYTES / 1024 / 1024} MB.`,
    };
  }
  // Some browsers report empty MIME for .svg — fall back to extension.
  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "");
  if (!LOGO_UPLOAD_ALLOWED_MIMES.has(mime)) {
    return {
      ok: false,
      error: `Unsupported file type (${
        file.type || "unknown"
      }). Allowed: SVG, PNG, JPEG.`,
    };
  }
  return { ok: true };
}

/**
 * Fetch the raw Markdown body of a brand's guidelines. Returns `""` when
 * the brand has no guidelines.md (404) — the editor treats missing-file as
 * "empty document" rather than an error.
 */
export async function getGuidelinesRaw(slug: string): Promise<string> {
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/guidelines?raw=1`,
      { cache: "no-store" },
    );
    if (res.status === 404) return "";
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch guidelines for ${slug}`),
      );
    }
    return await res.text();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Write a brand's guidelines.md via PUT. Server validates size (≤100 KB)
 * and MIME; we always send `text/markdown`. The `apiKey` is required —
 * the server rejects with 401 when missing.
 */
export async function putGuidelines(
  slug: string,
  markdown: string,
  apiKey: string,
): Promise<{ ok: boolean; slug: string; bytes: number }> {
  if (!apiKey) {
    throw new Error("API key is required to save guidelines");
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/guidelines`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "text/markdown",
          "x-api-key": apiKey,
        },
        body: markdown,
      },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to save guidelines for ${slug}`),
      );
    }
    return (await res.json()) as { ok: boolean; slug: string; bytes: number };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Metadata for a logo upload — all required by the server. */
export interface LogoUploadMeta {
  key: LogoKey;
  label: string;
  usage: string;
  preferred?: boolean;
}

/** Response from a successful logo upload. */
export interface LogoUploadResponse {
  ok: boolean;
  slug: string;
  key: LogoKey;
  file: string;
  url: string;
}

/**
 * Upload a logo for a directory brand. Validates the file client-side
 * first; throws via a rejected promise when the file is unacceptable or
 * when the server returns an error.
 */
export async function uploadLogo(
  slug: string,
  file: File,
  meta: LogoUploadMeta,
  apiKey: string,
): Promise<LogoUploadResponse> {
  if (!apiKey) {
    throw new Error("API key is required to upload logos");
  }
  const validation = validateLogoFile(file);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid file");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("key", meta.key);
  form.append("label", meta.label);
  form.append("usage", meta.usage);
  if (meta.preferred !== undefined) {
    form.append("preferred", meta.preferred ? "true" : "false");
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/logos`,
      {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
      },
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to upload logo for ${slug}`),
      );
    }
    return (await res.json()) as LogoUploadResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Delete a logo by key. A 404 for the key is treated as idempotent success
 * (the desired end state — key absent — is already satisfied).
 */
export async function deleteLogo(
  slug: string,
  key: LogoKey,
  apiKey: string,
): Promise<{ ok: boolean }> {
  if (!apiKey) {
    throw new Error("API key is required to delete logos");
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/brands/${encodeURIComponent(slug)}/logos/${encodeURIComponent(
        key,
      )}`,
      {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      },
    );
    if (res.status === 404) return { ok: true };
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to delete logo for ${slug}`),
      );
    }
    return (await res.json()) as { ok: boolean };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Icons (SPEC-003 / SPEC-009) ────────────────────────────────────
//
// Client functions for the Material Symbols icon library. The `/icons`
// browser uses `getIcons({ limit: 0 })` to pull the full catalogue in
// one request so virtualization can run against an in-memory array
// (REQ-065). External callers use paginated access with `limit<=100`.
//
// All shapes live in `lib/types/api.ts` (SSoT). We import the canonical
// names and re-export the pre-SPEC-010 aliases (`IconMetadata`,
// `IconsListResponse`) so existing consumers keep compiling unchanged.


export type IconStyle = _IconStyle;
export type IconMeta = _IconMeta;
export type IconMetadata = _IconMetadata;
export type IconList = _IconList;
export type IconsListResponse = _IconsListResponse;
export type IconsCategory = _IconsCategory;
export type IconsListParams = _IconsListParams;

/** GET /api/icons — returns items, total, page, limit. */
export async function getIcons(
  params?: IconsListParams,
): Promise<IconsListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.style) qs.set("style", params.style);
  if (params?.category) qs.set("category", params.category);
  if (typeof params?.page === "number") qs.set("page", String(params.page));
  if (typeof params?.limit === "number") qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    const res = await fetch(`${API_BASE}/api/icons${suffix}`);
    if (!res.ok) {
      throw new Error(await parseApiError(res, "Failed to fetch icons"));
    }
    return (await res.json()) as IconsListResponse;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** GET /api/icons/:name — returns metadata + availableStyles. */
export async function getIcon(name: string): Promise<IconMetadata> {
  try {
    const res = await fetch(
      `${API_BASE}/api/icons/${encodeURIComponent(name)}`,
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch icon: ${name}`),
      );
    }
    return (await res.json()) as IconMetadata;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * GET /api/icons/:name/svg?style=... — returns the raw SVG as text.
 *
 * The server sets `X-Content-Type-Options: nosniff` and validates both
 * :name and style. Callers must not pass user-supplied values without
 * running them through the same regex `^[a-z0-9_]+$`.
 */
export async function getIconSvg(
  name: string,
  style: IconStyle = "outlined",
): Promise<string> {
  try {
    const res = await fetch(
      `${API_BASE}/api/icons/${encodeURIComponent(name)}/svg?style=${encodeURIComponent(style)}`,
    );
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, `Failed to fetch SVG: ${name} (${style})`),
      );
    }
    return await res.text();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Public URL for embedding an icon's SVG directly via <img src="..." />. */
export function getIconSvgUrl(name: string, style: IconStyle = "outlined"): string {
  return `${API_BASE}/api/icons/${encodeURIComponent(name)}/svg?style=${encodeURIComponent(style)}`;
}

/** GET /api/icons/categories — returns [{ category, count }]. */
export async function getIconCategories(): Promise<IconsCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/icons/categories`);
    if (!res.ok) {
      throw new Error(
        await parseApiError(res, "Failed to fetch icon categories"),
      );
    }
    const data = (await res.json()) as { categories: IconsCategory[] };
    return data.categories;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

