/**
 * Shared brand data model — union type supporting both the legacy flat
 * `colors: Record<string, string>` shape and the expanded role-grouped shape
 * introduced in the Design Library Expansion (BRD REQ-001 through REQ-005).
 *
 * Consumed by the Express API (server-side) and the Next.js app (client-side).
 * Both sides must handle either shape without crashing.
 */

/** Legacy flat colors: `{ primary: "#3b82f6", secondary: "#…", … }`. */
export type FlatColors = Record<string, string>;

/**
 * A single color entry in the role-grouped schema. Stored verbatim in
 * `brand.json` under `colors.<group>.<name>`.
 */
export interface ColorEntry {
  hex: string;
  rgb: [number, number, number];
  role: string;
}

/**
 * Role-grouped colors — top-level groups keyed by semantic role
 * (primary, medium, light, neutral), each containing named color entries.
 * Every group is optional, and groups may be empty objects.
 */
export interface RoleGroupedColors {
  primary?: Record<string, ColorEntry>;
  medium?: Record<string, ColorEntry>;
  light?: Record<string, ColorEntry>;
  neutral?: Record<string, ColorEntry>;
}

/** Logo entry (file in `brands/<slug>/assets/`). */
export interface LogoEntry {
  file: string;
  label: string;
  usage: string;
  preferred?: boolean;
}

/** Logos configuration — all variants optional. */
export interface Logos {
  horizontal?: LogoEntry;
  vertical?: LogoEntry;
  icon?: LogoEntry;
}

/** One entry in a typography `scale` map (e.g., h1, base, small). */
export interface TypographyScaleEntry {
  size: string;
  lineHeight: string;
  weight: number | string;
}

/** A typography group (headings or body) with family, weights, and scale. */
export interface TypographyGroup {
  family: string;
  weights: Array<number | string>;
  scale: Record<string, TypographyScaleEntry>;
}

/** Typography specimens. Both groups optional for back-compat. */
export interface Typography {
  headings?: TypographyGroup;
  body?: TypographyGroup;
}

/**
 * Legacy logo field — flat brands use this instead of `logos`.
 * Preserved for back-compat only.
 */
export interface LegacyBrandLogo {
  mark?: string;
  horizontal?: string;
  favicon?: string;
}

/**
 * Unified brand configuration. `colors` is a union of the two supported
 * shapes; callers must detect which shape at runtime via
 * `isRoleGroupedColors`.
 *
 * Fields marked optional are either new (logos, typography, guidelines) or
 * legacy (logo).
 */
export interface BrandConfig {
  name: string;
  slug: string;
  description?: string;
  colors: FlatColors | RoleGroupedColors;
  fonts: { heading: string; body: string; mono?: string };
  /** Spacing unit is a *number* per PRD (e.g., 4 = 4px base). */
  spacing: { unit: number; scale: number[] };
  borderRadius: { small: string; medium: string; large: string; full: string };
  shadows: { small: string; medium: string; large: string };

  // New — optional for backwards compatibility with flat brands.
  logos?: Logos;
  typography?: Typography;

  // Legacy — flat brands only.
  logo?: LegacyBrandLogo;

  // Internal — set by the loader to indicate where the brand was loaded from.
  // Never written to disk. Always `'directory'` or `'flat'`.
  _source?: "directory" | "flat";
}

/**
 * Runtime type guard that distinguishes role-grouped colors from flat colors.
 *
 * Flat colors: every value is a string (e.g., `"#0057B8"`).
 * Role-grouped: values are group objects whose inner values look like
 * `{ hex, rgb, role }`.
 *
 * Robust against:
 *  - `null` (typeof null === 'object' — we check explicitly)
 *  - empty groups like `{ primary: {} }` — returns `false` because we cannot
 *    prove the shape is role-grouped without at least one `ColorEntry`. Empty
 *    role-grouped is treated as indeterminate / flat-like for rendering.
 *  - non-object primitives passed by mistake.
 */
export function isRoleGroupedColors(
  c: BrandConfig["colors"] | undefined | null,
): c is RoleGroupedColors {
  if (typeof c !== "object" || c === null) return false;

  // A role-grouped object has at least one group whose inner values include
  // a ColorEntry (object with a `hex` property). A flat color map, by
  // contrast, has string values at the top level — those cannot be groups.
  for (const group of Object.values(c)) {
    if (typeof group !== "object" || group === null) return false;
    for (const entry of Object.values(group)) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "hex" in (entry as object)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract a single representative "primary" color hex from either color
 * shape, for use in list summaries and cards.
 *
 * - Flat: returns `colors.primary` if present, else the first string value,
 *   else `"#3b82f6"` as a last-ditch fallback.
 * - Role-grouped: returns the first color of the `primary` group if any,
 *   else the first color of the first non-empty group, else the fallback.
 */
export function extractPrimaryColor(c: BrandConfig["colors"]): string {
  const FALLBACK = "#3b82f6";
  if (typeof c !== "object" || c === null) return FALLBACK;

  if (isRoleGroupedColors(c)) {
    const groupOrder: Array<keyof RoleGroupedColors> = [
      "primary",
      "medium",
      "light",
      "neutral",
    ];
    for (const key of groupOrder) {
      const group = c[key];
      if (group && typeof group === "object") {
        const firstEntry = Object.values(group)[0];
        if (firstEntry && typeof firstEntry.hex === "string") {
          return firstEntry.hex;
        }
      }
    }
    // Check any other unexpected groups
    for (const group of Object.values(c)) {
      if (group && typeof group === "object") {
        const firstEntry = Object.values(group)[0];
        if (firstEntry && typeof firstEntry === "object" && "hex" in firstEntry) {
          const hex = (firstEntry as ColorEntry).hex;
          if (typeof hex === "string") return hex;
        }
      }
    }
    return FALLBACK;
  }

  // Flat shape
  const flat = c as FlatColors;
  if (typeof flat.primary === "string") return flat.primary;
  const first = Object.values(flat).find((v) => typeof v === "string");
  return typeof first === "string" ? first : FALLBACK;
}
