# Migration Guide

## Overview

Design Library Expansion introduced two major changes to the data model and API:

1. **Brand format evolution:** From flat JSON files to directory-based structure with separate config, guidelines, and assets
2. **Component metadata enrichment:** Legacy 14-item manifest replaced with TSX-extracted full registry

Both changes are **backward-compatible** — old formats continue to work via feature flags and compatibility layers.

---

## Part 1: Migrating Brands (Flat JSON → Directory)

### What Changed

**Old format:**
```
brands/
├── default.json
├── acme.json
└── legacy-brand.json
```

Each brand is a single `.json` file with all metadata inline.

**New format:**
```
brands/
├── default/
│   ├── brand.json         # Config only
│   ├── guidelines.md      # Prose guidelines with frontmatter
│   └── assets/            # Logo SVGs, favicon, etc.
│       ├── logo.svg
│       └── logo-alt.svg
├── acme/
│   ├── brand.json
│   ├── guidelines.md
│   └── assets/
└── legacy-brand.json      # Still works for backward compat
```

### Why Migrate

**Benefits:**
- Cleaner separation of concerns (config ≠ prose ≠ assets)
- Easier to manage logos and brand assets separately
- Prose guidelines support rich markdown with frontmatter
- Scales better with brand portfolios

**What you can do after migration:**
- Upload logos via `POST /api/brands/:slug/logos`
- Update guidelines prose via `PUT /api/brands/:slug/guidelines`
- Reference brand colors by role, not just by name
- Serve multiple logo variations per brand

### Backward Compatibility

Flat JSON brands continue to work during transition:

```javascript
// Both formats work:
GET /api/brands/default      // ✅ directory format
GET /api/brands/legacy-brand // ✅ flat JSON format (reads from legacy-brand.json)
```

**How it works:**
- `brandIndex.ts` checks both `brands/<slug>/brand.json` and `brands/<slug>.json`
- Flat JSON brands return complete object (all fields intact)
- Directory brands merge `brand.json` + `guidelines.md` + logo metadata
- No forced migration — both coexist

### Migration Script

**Run this to convert all flat JSON brands to directory format:**

```bash
npm run brands:migrate
```

**What it does:**

1. Scans `brands/` for `.json` files
2. For each flat brand:
   - Creates `brands/<slug>/` directory
   - Moves brand metadata to `brands/<slug>/brand.json`
   - Generates placeholder `brands/<slug>/guidelines.md` if not present
   - Creates empty `brands/<slug>/assets/` directory
   - Removes original flat `.json` file
3. Outputs migration report (count of migrated brands, errors)

**Example output:**
```
Migrating brands...
✓ Migrated: default (brands/default/)
✓ Migrated: acme (brands/acme/)
✓ Migrated: legacy-brand (brands/legacy-brand/)
Migration complete: 3 brands migrated, 0 errors
```

### Manual Migration (Single Brand)

If you prefer to migrate one brand at a time:

```bash
# 1. Create directory
mkdir -p brands/my-brand/assets

# 2. Move metadata (read existing .json, extract to brand.json)
# Copy colors, fonts, spacing, etc. to:
cat > brands/my-brand/brand.json <<EOF
{
  "name": "My Brand",
  "slug": "my-brand",
  "description": "...",
  "fonts": { ... },
  "colors": { ... },
  ...
}
EOF

# 3. Create guidelines (if migrating from inline prose)
cat > brands/my-brand/guidelines.md <<EOF
---
brand: my-brand
version: 1.0
last_updated: 2026-04-17
---

# Guidelines

Your prose here...
EOF

# 4. Move logo SVGs to assets/
mv brands/my-brand-logo.svg brands/my-brand/assets/logo.svg

# 5. Delete old flat JSON
rm brands/my-brand.json
```

### Accessing Migrated Data

After migration, both APIs work identically:

```bash
# Get full brand config
curl http://localhost:8096/api/brands/my-brand

# Get identity section only (portal)
curl http://localhost:8096/api/brands/my-brand/identity

# Get colors
curl http://localhost:8096/api/brands/my-brand/colors

# Get guidelines (now parsed from markdown)
curl http://localhost:8096/api/brands/my-brand/guidelines

# Get logos (now served from assets/)
curl http://localhost:8096/api/brands/my-brand/logos

# Upload new logo
curl -X POST \
  -F "file=@my-logo.svg" \
  -F "name=logo" \
  http://localhost:8096/api/brands/my-brand/logos
```

### Rollback

If you need to revert a migration (though not recommended):

```bash
# Restore from backup
tar -xzf brands-backup-YYYYMMDD_HHMMSS.tar.gz

# Restart container
docker compose restart design
```

---

## Part 2: Component Metadata Expansion

### What Changed

**Old format (14-item legacy manifest):**

Hard-coded list of components, minimal metadata:

```json
[
  {
    "name": "Button",
    "category": "Form"
  },
  {
    "name": "Card",
    "category": "Layout"
  },
  // ... 12 more items
]
```

**New format (enriched registry):**

Extracted from TypeScript source with full metadata:

```json
[
  {
    "name": "Button",
    "tier": "ui",
    "path": "src/components/ui/Button.tsx",
    "description": "Primary action button",
    "props": [
      { "name": "variant", "type": "string" },
      { "name": "size", "type": "string" },
      { "name": "children", "type": "ReactNode", "required": true }
    ],
    "variants": {
      "variant": ["default", "secondary", "ghost"],
      "size": ["sm", "md", "lg"]
    },
    "examples": [
      {
        "label": "Default",
        "code": "<Button>Click me</Button>"
      }
    ]
  },
  // ... full registry
]
```

### Backward Compatibility

**Feature flag:** `DISABLE_ENRICHED_COMPONENTS`

Set to `1` to return legacy 14-item manifest:

```bash
DISABLE_ENRICHED_COMPONENTS=1 npm run dev
```

**Requires container restart:**
```bash
DISABLE_ENRICHED_COMPONENTS=1 docker compose up
```

### Regenerating Component Registry

If you add new components:

```bash
npm run generate:registry
```

This:
1. Parses all TSX files in `src/components/`
2. Extracts props, types, and metadata
3. Regenerates `src/components/registry.json`
4. Updates AI context in `src/mcp/ai-context.json`

### Component Response Shape

**Old API response (legacy):**
```json
GET /api/components

[
  { "name": "Button", "category": "Form" },
  { "name": "Card", "category": "Layout" },
  ...
]
```

**New API response:**
```json
GET /api/components

[
  {
    "name": "Button",
    "tier": "ui",
    "path": "src/components/ui/Button.tsx",
    "description": "Primary action button",
    "props": [
      { "name": "variant", "type": "string" },
      ...
    ],
    "variants": { ... },
    "examples": [ ... ]
  },
  ...
]
```

**Endpoint:**
```
GET /api/components/:name
```

Returns single component spec with full metadata.

---

## Part 3: Portal Redirects

### Route Changes

**Old route:**
```
/components-library
```

**New routes:**
```
/components          # Component spec browser (admin)
/icons               # Icon library browser (admin)
/portal/:slug        # Public brand portal
```

### Backward Compatibility

Old `/components-library` link redirected via Next.js rewrite (in `next.config.ts`):

```typescript
rewrites: async () => [
  {
    source: '/components-library',
    destination: '/components'
  }
]
```

Any bookmarks or links to `/components-library` automatically forward to `/components`.

### Public Portal

New public portal pages at `/portal/:slug` show:

- Brand identity (colors, fonts, spacing, shadows)
- Logo downloads
- Typography samples
- Guidelines prose (if available)

Example:
```
http://localhost:8095/portal/default
```

**Search indexing:**

Portal pages include robots meta tag:

```html
<meta name="robots" content="noindex,nofollow" />  <!-- Default (secure) -->
```

To enable indexing (production only with approval):

```bash
PORTAL_INDEX=1 docker compose up
```

Portal pages then include:
```html
<meta name="robots" content="index,follow" />
```

---

## Part 4: API Key Migration

### What Changed

Previously, writes were unauthenticated. Now you can (and should in production) require an API key.

### Implementation

**Old:**
```bash
curl -X POST http://localhost:8096/api/brands \
  -H "Content-Type: application/json" \
  -d '{...}'  # ✅ Worked without auth
```

**New (with `DESIGN_API_KEY` set):**
```bash
curl -X POST http://localhost:8096/api/brands \
  -H "X-Api-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{...}'  # ✅ Now requires header
```

### Deployment

**Development (optional):**
```bash
npm run dev  # No API key required
```

**Production (required):**
```bash
DESIGN_API_KEY=$(openssl rand -hex 32) docker compose up
```

**For existing automations:**

If you have scripts/webhooks that call the API:

1. Generate a key: `openssl rand -hex 32`
2. Set `DESIGN_API_KEY` in deployment
3. Update your scripts to include header:

```bash
curl -X POST \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  ...
```

---

## Part 5: Feature Flag Rollout

### Safe Rollout Strategy

Use feature flags to roll out changes without downtime:

```bash
# Phase 1: Deploy with new code, old behavior
DISABLE_ENRICHED_COMPONENTS=1 \
DISABLE_ICONS=1 \
docker compose up -d

# Phase 2: Test new features in staging
curl http://localhost:8096/api/components | jq '.length'  # Should return 14

# Phase 3: Enable one feature at a time
DISABLE_ENRICHED_COMPONENTS=0 \
DISABLE_ICONS=1 \
docker compose up -d

# Verify enriched components work
curl http://localhost:8096/api/components | jq '.[0]'  # Check full metadata

# Phase 4: Enable all features
DISABLE_ENRICHED_COMPONENTS=0 \
DISABLE_ICONS=0 \
docker compose up -d
```

### Monitoring During Rollout

```bash
# Watch logs for errors
docker compose logs -f design

# Check API responses
watch 'curl -s http://localhost:8096/api/brands | jq ".[] | .slug"'

# Monitor disk usage (icon sync)
df -h ./icons/

# Check feature flag status
curl http://localhost:8096/api/system/config | jq '.flags'
```

---

## Part 6: Troubleshooting

### Migration Issues

**Problem:** `npm run brands:migrate` fails with "permission denied"

**Solution:**
```bash
# Check directory permissions
ls -la ./brands

# Fix permissions (within container)
docker compose exec design chmod -R 755 ./brands
```

**Problem:** Old flat JSON brands still being served

**Solution:**
```bash
# Verify migration ran
ls -la ./brands/*/brand.json  # Should exist

# Restart API
docker compose restart design
```

### Component Registry Issues

**Problem:** New components don't appear in registry

**Solution:**
```bash
# Regenerate registry
npm run generate:registry

# Verify
cat src/components/registry.json | jq '.[] | .name'
```

**Problem:** Props metadata missing

**Solution:**

Check that component file has proper TypeScript types:

```typescript
// ✅ Good (extractable props)
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

// ❌ Bad (not extractable)
export default function Button(props: any) { ... }
```

Regenerate registry after fixing types:
```bash
npm run generate:registry
```

### Portal Indexing Issues

**Problem:** Portal pages appearing in search when `PORTAL_INDEX` unset

**Solution:**

Verify robots meta tag in rendered HTML:

```bash
curl http://localhost:8095/portal/default | grep robots
# Should see: <meta name="robots" content="noindex,nofollow" />
```

If missing, check `middleware.ts` CSP configuration.

### API Key Issues

**Problem:** "Unauthorized" error on POST requests

**Solution:**

1. Verify `DESIGN_API_KEY` is set:
   ```bash
   echo $DESIGN_API_KEY
   ```

2. Include header in request:
   ```bash
   curl -X POST \
     -H "X-Api-Key: $DESIGN_API_KEY" \
     http://localhost:8096/api/brands
   ```

3. Verify constant-time comparison in `src/api/middleware/auth.ts`

---

## Summary

| Change | Old Way | New Way | Backward Compatible |
|--------|---------|---------|-------------------|
| Brand storage | Flat `.json` | Directory with `brand.json`, `guidelines.md`, `assets/` | ✅ Yes (flag: none) |
| Component metadata | 14-item manifest | Full TSX-extracted registry | ✅ Yes (`DISABLE_ENRICHED_COMPONENTS=1`) |
| Component endpoint | N/A | `/components`, `/api/components` | ✅ Yes (legacy route redirected) |
| API authentication | None | Optional (required in production) | ✅ Yes (flag: `DESIGN_API_KEY`) |
| Portal indexing | N/A | Secure-by-default `noindex` | ✅ Yes (flag: `PORTAL_INDEX=1`) |

**Recommended migration path:**

1. ✅ Run `npm run brands:migrate` to convert flat brands (or do manually)
2. ✅ Set `DESIGN_API_KEY` in production deployment
3. ✅ Test component registry with enriched metadata (`npm run generate:registry`)
4. ✅ Populate icons if desired (`npm run icons:sync`)
5. ✅ Enable portal indexing only on production with approval (`PORTAL_INDEX=1`)

All changes are **non-breaking** if feature flags are used appropriately during rollout.
