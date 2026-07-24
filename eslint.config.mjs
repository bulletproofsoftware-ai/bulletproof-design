import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "templates/**",
      "design-tokens/**",
      "*.config.*",
      "scripts/**",
    ],
  },

  // Base config for all TS/TSX files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // General overrides
  {
    rules: {
      // Loosen rules that are too strict for existing codebase
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/triple-slash-reference": "off", // Next.js generates triple-slash refs
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-console": "off", // TODO: tighten to "warn" later
      "prefer-const": "warn",
      "no-useless-assignment": "warn",
    },
  },

  // ──────────────────────────────────────────────────────────────
  // Import boundary enforcement
  // ──────────────────────────────────────────────────────────────

  // UI layer: cannot import from primitives, features, or effects
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/primitives/*", "@/components/primitives/**"],
              message: "UI components cannot import from primitives layer.",
            },
            {
              group: ["@/components/features/*", "@/components/features/**"],
              message: "UI components cannot import from features layer.",
            },
            {
              group: ["@/components/effects/*", "@/components/effects/**"],
              message: "UI components cannot import from effects layer.",
            },
          ],
        },
      ],
    },
  },

  // Primitives layer: cannot import from features or effects
  {
    files: ["components/primitives/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/features/*", "@/components/features/**"],
              message:
                "Primitives cannot import from features layer.",
            },
            {
              group: ["@/components/effects/*", "@/components/effects/**"],
              message:
                "Primitives cannot import from effects layer.",
            },
          ],
        },
      ],
    },
  },

  // Features layer: cannot import from effects or cross-feature
  {
    files: ["components/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/effects/*", "@/components/effects/**"],
              message:
                "Features cannot import from effects layer.",
            },
          ],
        },
      ],
    },
  },

  // Effects layer: cannot import from primitives or features
  {
    files: ["components/effects/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/primitives/*",
                "@/components/primitives/**",
              ],
              message:
                "Effects cannot import from primitives layer.",
            },
            {
              group: ["@/components/features/*", "@/components/features/**"],
              message:
                "Effects cannot import from features layer.",
            },
          ],
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // Cross-feature import guard for features (except Nav→SearchCommand)
  // Nav.tsx has an eslint-disable for the known cross-feature import.
  // ──────────────────────────────────────────────────────────────

  // Per-feature cross-import rules
  // Each feature directory is restricted from importing other features.
  // We define one override per feature folder.
  ...buildCrossFeatureRules([
    "Sidebar",
    "TemplateCard",
    "BrandCard",
    "AssetCard",
    "MonacoEditor",
    "LivePreview",
    "SearchCommand",
    "Breadcrumbs",
    "Nav",
    // Portal features (SPEC-006, REQ-009 .. REQ-014)
    "PortalSidebar",
    "PortalBreadcrumbs",
    "LogoLockupCard",
    "ColorSwatch",
    "TypeSpecimen",
    "SanitisedHtml",
  ]),

  // ──────────────────────────────────────────────────────────────
  // Token enforcement: warn on hardcoded hex colors in component TSX
  // (excluding components/ui/ which is managed by shadcn)
  // ──────────────────────────────────────────────────────────────
  {
    files: [
      "components/primitives/**/*.tsx",
      "components/features/**/*.tsx",
      "components/effects/**/*.tsx",
    ],
    rules: {
      // TODO: Tighten to "error" once existing violations are cleaned up.
      // This catches hex color literals like "#fff", "#1a2b3c", "#1a2b3cFF"
      // in JSX attribute values. It is intentionally broad — disable per-line
      // for legitimate uses (e.g., SVG data URIs).
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            'JSXAttribute > Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message:
            "Avoid hardcoded hex colors — use design tokens or CSS variables instead.",
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // Hydration safety: warn on window/document/localStorage in components
  // Developers must use eslint-disable for legitimate "use client" usage
  // ──────────────────────────────────────────────────────────────
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      // TODO: Tighten to "error" once all components are properly annotated.
      // In "use client" components, access these inside useEffect only.
      "no-restricted-globals": [
        "warn",
        {
          name: "window",
          message:
            'Avoid direct "window" access in components — use useEffect or typeof window guard for hydration safety.',
        },
        {
          name: "document",
          message:
            'Avoid direct "document" access in components — use useEffect or refs for hydration safety.',
        },
        {
          name: "localStorage",
          message:
            'Avoid direct "localStorage" access in components — wrap in useEffect for hydration safety.',
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // Import plugin (basic resolution checks)
  // ──────────────────────────────────────────────────────────────
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-duplicates": "warn",
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
  },
);

/**
 * Build cross-feature import restriction rules.
 * For each feature directory, restrict imports from all OTHER feature directories.
 */
function buildCrossFeatureRules(features) {
  return features.map((feature) => {
    const otherFeatures = features.filter((f) => f !== feature);
    const patterns = otherFeatures.map((other) => ({
      group: [
        `@/components/features/${other}`,
        `@/components/features/${other}/*`,
        `@/components/features/${other}/**`,
      ],
      message: `Cross-feature import: ${feature} should not import from ${other}. Extract shared logic to primitives or a shared module.`,
    }));

    return {
      files: [`components/features/${feature}/**/*.{ts,tsx}`],
      rules: {
        "no-restricted-imports": [
          "error",
          { patterns },
        ],
      },
    };
  });
}
