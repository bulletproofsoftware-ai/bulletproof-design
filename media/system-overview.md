# Technical Briefing: bulletproof-design Architecture and Implementation

## 1. System Overview and Core Philosophy
The bulletproof-design system is a high-integrity, self-hosted brand and design asset management solution. Architected for maximum control and performance, it serves as a centralized source of truth for brand configurations, design tokens, icons, and component documentation.

The system adheres to a decoupled architecture comprising a **Next.js 15** frontend and a standalone **Express API**. For deployment efficiency and environment parity, the infrastructure is orchestrated within a single Docker container managed by **supervisord**. This strategy ensures that both services operate within the same lifecycle, sharing a unified working directory and mounted data volumes for brands, templates, assets, and icons.

## 2. Two-Server Architecture
The system employs a dual-service approach to maintain a strict separation between the user interface and data management layers.

*   **Next.js Application (Port 8095):** Responsible for server-side rendering (SSR) of public portal pages and the administrative interface using the Next.js App Router. To ensure architectural integrity, the frontend is strictly hydration-safe, prohibiting direct `window` or `document` access outside of `useEffect` hooks.
*   **Express API (Port 8096):** A file-system backed REST API that manages data persistence, indexing, and security. It leverages in-memory indexing—rebuilt from disk at startup—to ensure high-performance access to templates, brands, components, and icons.

### Responsibility Comparison

| Next.js Frontend (Port 8095) | Express Backend (Port 8096) |
| :--- | :--- |
| Server-side rendering (SSR) for portals | File-system operations and I/O management |
| Client-side navigation via App Router | In-memory data indexing (Performance Layer) |
| Admin interface and design editor UI | RESTful endpoint and MCP tool management |
| Data consumption via internal fetch calls | Shared SVG sanitization pipeline |
| Application-level Middleware (CSP/CORS) | Rate limiting and write-access authentication |

## 3. Component Tier Hierarchy
To prevent architectural drift and animation bloat, the system enforces a four-layer component hierarchy via `eslint-plugin-import`.

1.  **Layer 1: UI Components (`components/ui/`):** Base primitives (e.g., shadcn/ui). These are isolated and may not import from any other internal layer.
2.  **Layer 2: Primitives (`components/primitives/`):** Custom reusable components (e.g., `ColorPicker`, `TagInput`) built specifically on Layer 1. Imports are restricted to the UI layer.
3.  **Layer 3: Features (`components/features/`):** Page-level components (e.g., `Sidebar`, `BrandCard`). These can import from Primitives and UI layers. Cross-feature imports are prohibited to ensure modularity; shared logic must be promoted to the Primitives layer.
4.  **Layer 4: Effects (`components/effects/`):** Animation and visual effect wrappers (e.g., `FadeIn`). These are restricted to importing only from Layer 1 (UI) to prevent the injection of heavy animation logic into feature or primitive components.

## 4. Data Model and Content Management

### Brand Directory Structure
The system utilizes a directory-based format located at `brands/<slug>/`. This migration from flat JSON allows for better asset grouping.
*   **brand.json:** The primary schema for colors, typography, and spacing. It preserves legacy fields while allowing for schema evolution.
*   **guidelines.md:** Contains brand prose with YAML frontmatter.

### Guidelines Parser
The utility at `src/api/lib/guidelinesParser.ts` converts the `guidelines.md` file into a structured `ParsedGuidelines` object by extracting frontmatter and rendering H2 sections from Markdown to HTML.

### Component Registry & TSX Parser
Component metadata is not manually maintained. It is dynamically extracted from the TypeScript source code via a **TSX prop parser**. This ensures that the component documentation, property definitions, and examples in the registry remain in perfect sync with the implementation.

### Icon Library and Sanitization
The system manages ~2,500 Material Symbols (outlined, rounded, sharp styles). These are updated via `npm run icons:sync`. All icons, as well as brand logos uploaded via the API, pass through a **shared sanitization pipeline** to ensure security consistency across the platform.

### Design Tokens
Tokens follow the **DTCG 1.0** format. The `npm run generate:tokens` command uses Style Dictionary to compile `tokens.json` into CSS custom properties and JavaScript objects, supporting dark and high-contrast theme variants.

## 5. API Reference and Connectivity

### MCP Tools
The system includes a Model Context Protocol (MCP) server for AI tool integration, exposing the following read-only tools:

| Tool Name | Input | Output |
| :--- | :--- | :--- |
| `get_component` | Component name | Full registry entry |
| `search_components` | Search query | Array of matching components |
| `get_asset` | Asset name | Asset metadata |
| `get_tokens` | Category | Design tokens by category |
| `get_composition_rules` | Component name | Composition constraints |
| `get_brand_identity` | Brand slug | Colors, fonts, spacing, shadows |
| `get_brand_guidelines` | Brand slug | Parsed guidelines and sections |
| `get_component_spec` | Component name | Props, variants, and examples |
| `search_icons` | Search query/tag | Matching icons with styles |
| `get_icon` | Name, style | Raw SVG content |

### Request Flow
1.  **Initialization:** Express server starts and builds in-memory indexes (templates, brands, components, icons).
2.  **Request:** Next.js client sends a fetch request to the API.
3.  **Validation:** Middleware applies `safeCompare` authentication and rate limiting.
4.  **Processing:** Lib functions query the high-speed in-memory indexes.
5.  **Response:** The API returns structured JSON or raw SVG content.

## 6. Security and Environment Control

### Authentication
Write endpoints (POST, PUT, DELETE, PATCH) are secured via the `DESIGN_API_KEY`. The system utilizes a `safeCompare` function for constant-time string comparison to mitigate timing attacks.

### Content Security Policy (CSP)
Managed in `src/app/middleware.ts`, the CSP is environment-aware. In production, the **nonce is regenerated per request** to maintain a strict security posture.

```text
# Production CSP (Strict)
script-src 'self' 'nonce-{random}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';

# Development CSP (HMR & Monaco Support)
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
```

### SVG Sanitization Pipeline
All SVGs (logos and synced icons) are processed via `sanitize-html`. The pipeline:
*   Strips all `<script>` tags and event handlers (`on*`).
*   Blocks external entity references (XXE prevention).
*   Enforces a strict whitelist of standard SVG elements and attributes.

### Rate Limiting
Enforced via Express middleware per 15-minute window:
*   **Read Endpoints:** 1,000 requests.
*   **Write Endpoints:** 100 requests.

## 7. Configuration and Feature Flags
Feature flags allow for zero-downtime control. A critical distinction is made between "Request" scope (evaluated per call) and "Startup" scope (requires container restart).

| Flag | Default | Scope | Technical Effect (when set to 1) |
| :--- | :--- | :--- | :--- |
| `DISABLE_PORTAL` | 0 | Request | Blocks portal API reads; portal pages return 404. |
| `DISABLE_ICONS` | 0 | **Startup** | Unmounts icon routes; requires restart. |
| `DISABLE_ENRICHED_COMPONENTS`| 0 | **Startup** | Returns legacy manifest; requires restart. |
| `PORTAL_INDEX` | unset | Request | Enables `index,follow` (CISO F-PORTAL-03 compliance). |
| `DESIGN_API_KEY` | unset | Request | Enables mandatory `safeCompare` check for writes. |
| `GITHUB_TOKEN` | unset | Script | Increases GitHub API limits for icon synchronization. |

## 8. Development and Deployment Lifecycle

### Critical CLI Commands
*   **Development:** `npm run dev` (Parallel service execution).
*   **Production:** `docker compose up --build` (Supervisord orchestration).
*   **Maintenance:** 
    *   `npm run generate:tokens` (Style Dictionary build).
    *   `npm run icons:sync` (Material Symbols ingestion and sanitization).
*   **Security:** `npm run audit:check` (Dependency vulnerability scan).

### Audit Gate
The system implements a mandatory "Audit Gate" within the CI/CD and Docker build pipeline. Using `audit-ci --high`, the build process will automatically abort if any **HIGH** or **CRITICAL** vulnerabilities are detected in production dependencies, ensuring no insecure image is ever promoted to deployment.