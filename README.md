# Design Library

A self-hosted brand and design asset library. Next.js 15 UI (port 8095) + standalone Express API (port 8096), both run by supervisord inside a single Docker container.

![bulletproof-design — overview](docs/media/infographic.png)

> 📚 Full documentation in [`docs/`](docs/) · 🔒 SBOM in [`docs/SBOM.md`](docs/SBOM.md) · 🎬 System overview: [briefing](media/system-overview.md) · [deck](media/bulletproof-design-deck.pdf).

## Quick Start

### Local Development (Two Processes)

```bash
npm ci --legacy-peer-deps   # legacy peer deps: eslint@10 peer conflict in the lockfile
npm run dev        # Next.js on :8095 (auto-generates design tokens first)
# In another terminal:
npm run api        # Express API on :8096
```

Open <http://localhost:8095>. The Next.js app fetches from the API at `localhost:8096`.

### Docker (Single Container)

```bash
docker build -t bulletproof-design . && docker run -p 8095:8095 -p 8096:8096 bulletproof-design
```

Both services start via supervisord. Ports: 8095 (Next.js), 8096 (API).

### Expansion Features Quick Start

**Brand Portal** — Manage brand configs, guidelines, and logos

```bash
# Admin editor: http://localhost:8095/admin/brands/default
# Create new brand:
curl -X POST http://localhost:8096/api/brands \
  -H "Content-Type: application/json" \
  -d '{"name":"My Brand","slug":"my-brand","description":"..."}'

# Upload logo:
curl -X POST -F "file=@logo.svg" http://localhost:8096/api/brands/my-brand/logos
```

**Component Spec Browser** — Full TypeScript props extraction

```bash
# Browse: http://localhost:8095/admin/components
# API: curl http://localhost:8096/api/components
```

**Icon Library** — 2,500+ Material Symbols with virtualized grid

```bash
# Browse: http://localhost:8095/admin/icons
# Populate icons:
npm run icons:sync

# Search: curl http://localhost:8096/api/icons/search?q=account
```

**Brand Migration** — Evolve from flat JSON to directory structure

```bash
# Automatic migration (flat JSON → directories):
npm run brands:migrate

# Manual: See [docs/MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md)
```

## Feature Flags

Environment-variable rollback levers. Default is `0` (feature enabled). Set to `1` to disable.

| Flag | Default | Effect when set to `1` |
|---|---|---|
| `DISABLE_PORTAL` | `0` | Next.js `/portal/*` returns 404. Portal-specific API reads return 404: `GET /api/brands/:slug/identity`, `GET /api/brands/:slug/logos`, `GET /api/brands/:slug/typography`, `GET /api/brands/:slug/guidelines`. Admin UI, admin write routes (`POST/DELETE /api/brands/:slug/logos`, `PUT /api/brands/:slug/guidelines`), and the static `/brand-assets/:slug/:file` surface all remain functional. |
| `DISABLE_ICONS` | `0` | `/api/icons*` routes are not mounted. `/icons` page shows an empty state with an explanatory banner. Useful when `icons/` directory has not been populated. |
| `DISABLE_ENRICHED_COMPONENTS` | `0` | `GET /api/components` serves the legacy 14-item Reshaped manifest. `/components` page renders but with reduced data. Fallback path for component metadata regressions. |
| `PORTAL_INDEX` | unset | Secure-by-default: portal pages emit `robots: noindex,nofollow` unless this is explicitly set to `1`. Set `PORTAL_INDEX=1` only on production tenants that have approved public search indexing. Staging, dev, and pre-release tenants MUST leave this unset. |
| `DESIGN_API_KEY` | unset | When set, all `POST/PUT/DELETE/PATCH` requests to `/api/*` require an `X-Api-Key: <value>` header. Read endpoints are unaffected. Required in production. |
| `GITHUB_TOKEN` | unset | Used by `npm run icons:sync` to raise GitHub API rate limits when fetching Material Symbols from `google/material-design-icons`. Not required but recommended. |

Flags are read at request time (except `DISABLE_ICONS` and `DISABLE_ENRICHED_COMPONENTS`, which affect router mounting at server startup — restart the container after changing them).

## Icons

Icons live under `icons/material-symbols/{outlined,rounded,sharp}/`. Each style directory holds ~2,500 SVGs. To populate:

```bash
# From inside the container
docker exec <container> npm run icons:sync

# From the host (set GITHUB_TOKEN to raise rate limits)
GITHUB_TOKEN=$(gh auth token) npm run icons:sync
```

The sync script sanitizes every downloaded SVG (shared pipeline with logo upload) and aborts on any SVG containing `<script>`, `on*` handlers, or external entity references.

## Portal

The public portal lives at `/portal/<slug>`, e.g. <http://localhost:8095/portal/default>. Portal pages:

- Default robots directive: `noindex,nofollow` (secure-by-default per REQ-093 / CISO F-PORTAL-03).
- Set `PORTAL_INDEX=1` to opt in to public search indexing. Only do this on production tenants that have approved public indexing. Staging, dev, and pre-release tenants MUST leave `PORTAL_INDEX` unset.
- Render logo SVGs via `<img src>` only; no `<iframe>` or inline `<script>`.

## Security

### Authentication

Set `DESIGN_API_KEY` to require an API key on all write endpoints:

```bash
DESIGN_API_KEY=$(openssl rand -hex 32) docker compose up
curl -X POST http://localhost:8096/api/brands \
  -H "X-Api-Key: $DESIGN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Content Security Policy

Production CSP (set `NODE_ENV=production`) is nonce-based: `script-src 'self' 'nonce-{random}' 'strict-dynamic'` — **no `'unsafe-inline'` on scripts**. Development retains `'unsafe-inline'` and `'unsafe-eval'` for HMR and Monaco eval. See `middleware.ts` for the exact directives.

### Supply Chain

```bash
npm run audit:check        # Fails on any HIGH or CRITICAL advisory (production deps)
npm run sbom:generate      # Requires syft; writes sbom.cdx.json (CycloneDX)
```

The `audit:check` gate also runs inside the Docker image build — `docker compose build` fails the image when a new HIGH or CRITICAL advisory surfaces against production dependencies. New expansion dependencies are pinned to exact versions in `package.json` (no `^` or `~`) until the first release.

## Architecture

**See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detailed system design.**

- `app/` — Next.js App Router. `app/portal/[slug]/*` is the public portal; `app/(admin)/*` is the admin editor.
- `src/api/` — Express API, router per resource (`templates`, `brands`, `components`, `search`, `import`, `assets`, `icons`, `preview`).
- `src/components/` — Four-tier component architecture enforced by ESLint: `ui/` → `primitives/` → `features/` → `effects/`.
- `design-tokens/` — DTCG-format source of truth; Style Dictionary builds CSS custom properties.
- `templates/`, `brands/`, `assets/`, `icons/` — Docker-mounted data volumes.

**Two-server setup:**
- Next.js app (port 8095) — UI for browsing templates, brands, assets, and new expansion features
- Express API (port 8096) — REST API for CRUD operations, file-system backed

**New data model:**
- Brands evolve from flat JSON to directory-based structure (`brands/<slug>/brand.json`, `guidelines.md`, `assets/`)
- Components enriched with full TSX prop extraction and metadata
- Icons virtualized for performant browsing of 2,500+ Material Symbols

## Commands

**Development:**
```bash
npm run dev               # Next.js on :8095
npm run api               # Express API on :8096
npm run build             # Production Next.js build
npm test                  # Jest (ESM); design tokens are generated first (pretest)
npm run lint              # ESLint with layered import boundaries
npm run typecheck         # tsc --noEmit
```

> **Running the API integration tests:** `__tests__/api.test.ts` and
> `__tests__/api-routes.test.ts` exercise a live API server and are skipped by
> default. Start the API (`npm run api`), then run them with
> `RUN_API_TESTS=1 npm test`.

**Generation & Maintenance:**
```bash
npm run generate:tokens   # Rebuild CSS variables from design-tokens/tokens.json
npm run generate:registry # Rebuild component + asset registries + AI context
npm run generate -- Foo   # Scaffold a new component
npm run icons:sync        # Populate icons/material-symbols/ from GitHub
npm run brands:migrate    # Migrate flat JSON brands to directory format
```

**Security:**
```bash
npm run audit:check       # Security audit on production deps (HIGH threshold)
npm run sbom:generate     # Generate CycloneDX SBOM for supply chain audit
```

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System design, component layers, API structure
- **[API.md](docs/API.md)** — REST API reference and MCP tools
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Docker deployment, environment variables, security
- **[MIGRATION-GUIDE.md](docs/MIGRATION-GUIDE.md)** — Brand format migration, component enrichment, rollout
- **[SBOM.md](docs/SBOM.md)** — Software Bill of Materials, security audit, supply chain

## Support & Contributing

Contributions welcome — please open an issue or PR.

## License

See `LICENSE`.
