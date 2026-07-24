# Architecture Overview

## System Design

Design Library is a self-hosted brand and design asset management system split into two independent servers orchestrated in a single Docker container via supervisord.

```
┌─────────────────────────────────────────────────────────┐
│           Docker Container (supervisord)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────┐         ┌──────────────────┐   │
│  │   Next.js App      │         │  Express API     │   │
│  │   (port 8095)      │◄────────│  (port 8096)     │   │
│  │                    │         │                  │   │
│  │ • Browsing UIs     │         │ • REST routes    │   │
│  │ • Admin editor     │         │ • File I/O       │   │
│  │ • Portal pages     │         │ • Rate limiting  │   │
│  │ • Monaco editor    │         │ • Auth (API key) │   │
│  └────────────────────┘         └──────────────────┘   │
│                                          ▲              │
│                                          │ fetch        │
│  ┌──────────────────────────────────────┘──────────┐   │
│  │          Docker-Mounted Volumes                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │  • brands/          (brand configs + guidelines)│   │
│  │  • templates/       (HTML template files)       │   │
│  │  • assets/          (logo SVGs, etc.)           │   │
│  │  • icons/material-symbols/  (2,500+ SVGs)      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Two-Server Architecture

**Next.js Application (port 8095)**
- Server-side rendering for public portal pages and admin interface
- Client-side navigation via App Router (route groups: `/portal`, `/(admin)`)
- Calls Express API at `localhost:8096` to fetch and manage data
- Hydration-safe (no direct `window`/`document` access outside `useEffect`)

**Express API (port 8096)**
- File-system backed REST API
- Helmet CSP headers, rate limiting, optional API key auth
- Routes for brands, components, templates, icons, assets, import, preview, search
- In-memory indexes rebuilt at startup from disk

**Container Orchestration (supervisord)**
- Single `docker compose up --build` command starts both services
- Both share the same `/app` working directory
- Both have access to mounted data volumes: `brands/`, `templates/`, `assets/`, `icons/`
- Environment variables control feature flags and security settings

---

## Data Model

### Brand Directory Format

Brands evolved from flat JSON files to a directory-based structure. Each brand lives in `brands/<slug>/`:

```
brands/
├── default/
│   ├── brand.json              # Brand metadata + design tokens
│   ├── guidelines.md           # Prose guidelines with frontmatter
│   └── assets/
│       ├── logo.svg
│       ├── logo-alt.svg
│       └── favicon.ico
├── acme/
│   ├── brand.json
│   ├── guidelines.md
│   └── assets/
│       └── logo.svg
└── legacy-flat-brand.json      # Backward-compat: flat JSON brands still work
```

#### brand.json Schema

Preserves all existing fields while adding new sections:

```json
{
  "name": "Brand Name",
  "slug": "brand-slug",
  "description": "Short description",
  "fonts": {
    "heading": "Georgia",
    "body": "Segoe UI",
    "mono": "Courier New"
  },
  "spacing": {
    "unit": "4px",
    "scale": [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
  },
  "borderRadius": {
    "small": "2px",
    "medium": "4px",
    "large": "8px",
    "full": "9999px"
  },
  "shadows": {
    "small": "0 1px 2px rgba(0,0,0,0.08)",
    "medium": "0 4px 6px rgba(0,0,0,0.10)",
    "large": "0 10px 20px rgba(0,0,0,0.15)"
  },
  "colors": {
    "primary": {
      "base": {
        "hex": "#1f2937",
        "rgb": [31, 41, 55],
        "role": "primary-background"
      },
      "light": {
        "hex": "#f3f4f6",
        "rgb": [243, 244, 246],
        "role": "primary-surface"
      }
    },
    "medium": { },
    "light": { },
    "neutral": { }
  }
}
```

#### guidelines.md Format

Frontmatter + markdown prose with embedded sections:

```markdown
---
brand: brand-slug
version: 1.0
last_updated: 2026-04-17
---

# Brand Guidelines

## Voice & Tone

Guidelines prose here...

## Logo Usage

Logo guidance...
```

Parser (`src/api/lib/guidelinesParser.ts`) extracts:
- YAML frontmatter
- H2 sections (with content and metadata)
- Markdown → HTML rendering
- Returns typed `ParsedGuidelines` object

### Icons

Material Symbols icons stored under `icons/material-symbols/{outlined,rounded,sharp}/`.

Each subdirectory contains ~2,500 SVG files named `icon_name.svg`.

Synced from `google/material-design-icons` GitHub repo via `npm run icons:sync`.

### Components

Component metadata stored in `src/components/registry.json`. Extracted from TypeScript source via TSX prop parser.

```json
{
  "name": "Button",
  "tier": "ui",
  "path": "src/components/ui/Button.tsx",
  "description": "Primary action button",
  "props": [
    { "name": "variant", "type": "string", "required": false },
    { "name": "size", "type": "string", "required": false }
  ],
  "variants": { "variant": ["default", "secondary"] },
  "examples": [ { "label": "Default", "code": "..." } ]
}
```

---

## Route Groups & Navigation

### Next.js Route Structure

```
app/
├── (admin)/
│   ├── page.tsx              # Admin home
│   ├── templates/            # Template browser + editor
│   ├── brands/
│   │   ├── page.tsx          # Brand list
│   │   └── [slug]/
│   │       ├── page.tsx      # Brand editor (tabbed interface)
│   │       ├── identity/
│   │       ├── logos/
│   │       ├── typography/
│   │       └── guidelines/
│   ├── components/           # Component spec browser
│   ├── icons/                # Icon library browser
│   └── assets/               # Asset management
│
├── portal/
│   ├── page.tsx              # Portal home (lists all brands)
│   └── [slug]/               # Public brand portal
│       ├── page.tsx
│       ├── identity/
│       ├── colors/
│       ├── typography/
│       └── guidelines/
│
├── layout.tsx                # Root layout
├── middleware.ts             # CSP, request logging
└── not-found.tsx             # 404 fallback
```

### Middleware & Security

**File:** `src/app/middleware.ts`

- **Content Security Policy (CSP)**
  - Production: `script-src 'self' 'nonce-{random}' 'strict-dynamic'` (strict, no `unsafe-inline`)
  - Development: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (HMR, Monaco)
  - Style: `'self' 'unsafe-inline' https://fonts.googleapis.com`

- **CORS**
  - Production: `CORS_ORIGIN` env var (comma-separated list)
  - Development: all origins allowed

- **Request Logging**
  - All non-GET requests logged with timestamp, method, path, IP

---

## Component Tier Hierarchy

**Four-layer component architecture enforced by ESLint:**

### Layer 1: UI Components (`components/ui/`)
- shadcn/ui primitives (new-york style)
- **Import from:** Nothing else (isolated)
- **Examples:** Button, Input, Dialog, Card, Badge, Tabs

### Layer 2: Primitives (`components/primitives/`)
- Custom reusable components built on Layer 1
- **Import from:** ui/ only
- **Examples:** ColorPicker, FontPicker, TagInput, ConfirmDialog, IconButton

### Layer 3: Features (`components/features/`)
- Page-level feature components
- **Import from:** primitives/, ui/
- **Forbidden:** Cross-feature imports (extract to primitives instead)
- **Examples:** Sidebar, MonacoEditor, LivePreview, SearchCommand, TemplateCard, BrandCard

### Layer 4: Effects (`components/effects/`)
- Animation and visual effect wrappers
- **Import from:** ui/ only
- **Examples:** FadeIn, SlideIn, ScaleTransform

**ESLint enforcement:** `eslint-plugin-import` with custom layer rules in `.eslintrc.json`.

---

## API Layer Architecture

### File Structure

```
src/api/
├── server.ts                 # Express app setup, middleware, routing
├── middleware/
│   ├── auth.ts              # API key validation (DESIGN_API_KEY)
│   └── disablePortal.ts     # DISABLE_PORTAL gate
├── routes/
│   ├── brands.ts            # Brand CRUD + portal endpoints
│   ├── components.ts        # Component registry API
│   ├── templates.ts         # Template CRUD
│   ├── icons.ts             # Icon search + metadata
│   ├── assets.ts            # Asset management
│   ├── import.ts            # Bulk import (HTML, JSON)
│   ├── preview.ts           # Template live preview rendering
│   ├── search.ts            # Cross-resource search
│   └── categories.ts        # Category enum
└── lib/
    ├── templateIndex.ts     # In-memory template index (lazy-loaded)
    ├── brandIndex.ts        # In-memory brand index (lazy-loaded)
    ├── iconIndex.ts         # Icon file enumeration + caching
    ├── componentIndex.ts    # Component registry indexing
    ├── guidelinesParser.ts  # Markdown → JSON parser
    ├── parser.ts            # HTML template metadata extractor
    ├── validation.ts        # Input validation (Ajv)
    ├── sanitizer.ts         # SVG + HTML sanitization
    ├── types/               # TypeScript interfaces
    │   ├── api.ts           # Single source of truth (SSoT) for API types
    │   ├── brand.ts
    │   ├── component.ts
    │   └── icon.ts
    └── constants.ts         # Regex, error messages, limits
```

### Request Flow

1. **Express server starts** → builds in-memory indexes (templates, brands, components, icons)
2. **Client (Next.js) sends request** → `fetch('http://localhost:8096/api/...')`
3. **Route handler** → applies auth, rate limiting, validation
4. **Lib function** → queries indexes or reads from disk
5. **Response** → JSON with proper error handling

### Middleware Stack

```typescript
app.use(helmet())                    // Security headers
app.use(cors())                      // CORS
app.use(express.json())              // Body parser
app.use(requestTimeout(30s))         // Abort slow requests
app.use(writeLimiter/readLimiter)    // Rate limiting
app.use(auditLogging)                // [audit] timestamp method path ip
app.use(apiKeyAuth)                  // X-Api-Key header validation
app.use(disablePortalGate)           // DISABLE_PORTAL check
```

### Error Handling

All routes return consistent error shape:

```json
{
  "error": "Error message",
  "status": 400,
  "code": "VALIDATION_ERROR"
}
```

---

## Design Tokens & Theming

### DTCG Format Source

**File:** `design-tokens/tokens.json` (DTCG 1.0)

```json
{
  "colors": {
    "primary": {
      "$value": "#1f2937",
      "$type": "color"
    },
    "surface": {
      "$value": "{colors.neutral.50}",
      "$type": "color"
    }
  },
  "spacing": {
    "unit": {
      "$value": "4px",
      "$type": "dimension"
    }
  },
  "typography": {
    "headingXl": {
      "$value": {
        "fontSize": "48px",
        "fontWeight": 700,
        "lineHeight": 1.2
      },
      "$type": "typography"
    }
  }
}
```

### Theme Variants

**Files:**
- `design-tokens/themes/dark.json`
- `design-tokens/themes/high-contrast.json`

Each theme overrides select tokens for variant rendering.

### CSS Custom Properties Build

**Command:** `npm run generate:tokens`

Uses Style Dictionary to compile DTCG source into:
- CSS custom properties (`--color-primary`, `--spacing-unit`)
- JavaScript object (`tokens.json`)
- Tailwind config integration

### ESLint Warning

Components hardcoding hex colors (e.g., `#1f2937` in TSX) trigger ESLint warning → use CSS variables instead.

---

## MCP Server

**File:** `src/mcp/design-system-server.ts`

Read-only MCP server exposing design system data to Claude Code and other AI tools.

**Launch:** `npx tsx src/mcp/design-system-server.ts`

### 10 Tools

#### Legacy Tools (REQ-044)

1. **`get_component`** — Look up component by name, return full registry entry
2. **`search_components`** — Search components by name/description
3. **`get_asset`** — Fetch asset metadata by name
4. **`get_tokens`** — Get design tokens by category
5. **`get_composition_rules`** — Fetch component composition constraints

#### New Tools (REQ-045–REQ-049)

6. **`get_brand_identity`** — Brand colors, fonts, spacing, shadows (identity section)
7. **`get_brand_guidelines`** — Brand guidelines prose parsed into structured sections
8. **`get_component_spec`** — Full component spec with props, variants, examples
9. **`search_icons`** — Search Material Symbols by name/tag
10. **`get_icon`** — Fetch icon SVG by name and style (outlined/rounded/sharp)

All tools accept:
- Input validation (Zod schemas)
- Feature flag checks (`DISABLE_*` env vars)
- Error responses in structured JSON

---

## Feature Flags

Rolled out via environment variables (set at request time):

| Flag | Default | Scope | Effect |
|------|---------|-------|--------|
| `DISABLE_PORTAL` | 0 | Request | Portal pages return 404; portal API reads blocked |
| `DISABLE_ICONS` | 0 | Startup | Icon routes unmounted; `/icons` page shows empty state |
| `DISABLE_ENRICHED_COMPONENTS` | 0 | Startup | Legacy 14-item component manifest returned |
| `PORTAL_INDEX` | unset | Request | Set to `1` to enable `robots: index,follow` on portal |
| `DESIGN_API_KEY` | unset | Request | Require X-Api-Key header for POST/PUT/DELETE |
| `GITHUB_TOKEN` | unset | Script | Raise GitHub API rate limits for `npm run icons:sync` |

Startup-scoped flags (`DISABLE_ICONS`, `DISABLE_ENRICHED_COMPONENTS`) require container restart to take effect.

---

## Security Architecture

### Authentication

- **API Key Optional** — Set `DESIGN_API_KEY` to require auth on write endpoints
- **Scope** — Only affects `POST`, `PUT`, `DELETE`, `PATCH`; read endpoints unaffected
- **Header** — `X-Api-Key: <value>`
- **Comparison** — Constant-time comparison (`safeCompare`) to prevent timing attacks

### Content Security Policy

**Development:**
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (HMR, Monaco editor)
- `style-src 'self' 'unsafe-inline'`

**Production:**
- `script-src 'self' 'nonce-{random}' 'strict-dynamic'` (no inline scripts)
- `style-src 'self' 'unsafe-inline'` (Tailwind)
- Nonce regenerated per request

### SVG Sanitization

**Library:** sanitize-html (2.17.3+)

- Strips all `<script>` tags
- Removes event handlers (`on*` attributes)
- Blocks external entity references (XXE prevention)
- Whitelist: standard SVG elements, attributes, and MathML

Applied to:
- Logo uploads (`POST /api/brands/:slug/logos`)
- Icon sync from GitHub (`npm run icons:sync`)

### Rate Limiting

- **Write endpoints** — 100 requests per 15 minutes
- **Read endpoints** — 1,000 requests per 15 minutes
- **Enforcement** — Express rate-limit middleware

### Supply Chain

**Audit Gate:**
```bash
npm run audit:check    # Fails if any HIGH or CRITICAL advisory in production deps
```

Also runs in Docker build:
```dockerfile
RUN npm run audit:check || exit 1
```

**SBOM Generation:**
```bash
npm run sbom:generate  # Outputs sbom.cdx.json (CycloneDX format)
```

---

## Summary

Design Library's architecture separates concerns:
- **Next.js** handles presentation, routing, client interactivity
- **Express API** manages file I/O, validation, indexing
- **Docker** orchestrates both via supervisord
- **Feature flags** provide zero-downtime rollout control
- **Security** enforced at multiple layers (CSP, auth, sanitization, audit)
- **MCP** exposes read-only design system data to AI tools
