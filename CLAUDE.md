# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A **Design Library** — a Next.js 15 web app + standalone Express API for browsing/editing HTML templates, brand configurations, and design assets. Runs as a Docker container with supervisord managing both processes.

## Commands

```bash
npm run dev          # Next.js on :8095 (auto-generates design tokens first)
npm run api          # Express API on :8096 (separate process)
npm run build        # Production Next.js build
npm test             # Jest (uses --experimental-vm-modules for ESM)
npm run lint         # ESLint with layered import boundary enforcement
npm run typecheck    # tsc --noEmit
npm run generate:tokens      # Rebuild CSS variables from design-tokens/tokens.json
npm run generate:registry    # Rebuild component + asset registries + AI context
npm run generate -- MyComp   # Scaffold a new component
```

Run a single test: `node --experimental-vm-modules node_modules/.bin/jest __tests__/api.test.ts --forceExit`

Docker: `docker compose up --build` — runs both Next.js (:8095) and API (:8096) via supervisord.

## Architecture

**Two servers in one container:**
- **Next.js app** (port 8095) — UI for browsing templates, brands, assets, with Monaco editor and live preview
- **Express API** (port 8096) — REST API for CRUD on templates/brands/assets, file-system backed

The Next.js app fetches from the Express API at `localhost:8096`. CSP headers in `middleware.ts` explicitly allow this cross-origin connection.

**Data lives on disk** — `templates/`, `brands/`, `assets/` directories are Docker-mounted volumes. The API reads/writes HTML files and JSON metadata directly. No database.

### API Structure (`src/api/`)
- `server.ts` — Express app with helmet, rate limiting (writes only), optional API key auth (`DESIGN_API_KEY`)
- `routes/` — templates, brands, assets, categories, components, search, import, preview
- `lib/` — `templateIndex.ts` and `brandIndex.ts` build in-memory indexes at startup; `parser.ts` extracts metadata from HTML templates; `validation.ts` for input validation

### Component Layers (enforced by ESLint)
Four-tier component architecture with strict import boundaries:
1. **`components/ui/`** — shadcn/ui primitives (new-york style). Cannot import from any other layer.
2. **`components/primitives/`** — Custom reusable components (ColorPicker, FontPicker, TagInput, ConfirmDialog, IconButton). Cannot import from features or effects.
3. **`components/features/`** — Page-level feature components (Sidebar, MonacoEditor, LivePreview, SearchCommand, TemplateCard, BrandCard, AssetCard). Cannot import from effects. **Cross-feature imports are forbidden** — extract shared logic to primitives.
4. **`components/effects/`** — Animation/visual effect components. Cannot import from primitives or features.

### Design Tokens
- Source of truth: `design-tokens/tokens.json` (DTCG format)
- Themes: `design-tokens/themes/dark.json`, `high-contrast.json`
- Built via Style Dictionary (`npm run generate:tokens`) into CSS custom properties
- ESLint warns on hardcoded hex colors in component TSX — use tokens/CSS variables instead

### MCP Server (`src/mcp/design-system-server.ts`)
Read-only MCP server exposing component registry, asset registry, and design tokens. Run: `npx tsx src/mcp/design-system-server.ts`

### Registries
- `src/components/registry.json` — component metadata (tier, props, variants, examples)
- `src/assets/registry.json` — asset catalog with metadata
- `src/assets/metadata.yaml` — asset metadata source
- Regenerate with `npm run generate:registry`

## Key Conventions

- **ESM throughout** — `"type": "module"` in package.json. Tests need `--experimental-vm-modules`.
- **Path alias** `@/*` maps to project root in both Next.js and Jest.
- **shadcn/ui** with new-york style, Tailwind v4, lucide-react icons.
- **Hydration safety** — ESLint warns on direct `window`/`document`/`localStorage` access in components. Use `useEffect` or typeof guards.
- **tsconfig excludes** `templates/` and `src/api/` from the Next.js compilation. The API runs via `tsx` directly.
- **Pre-commit hooks** via husky + lint-staged (ESLint fix on `.ts/.tsx`).
