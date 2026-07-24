# API Reference

Design Library REST API runs on port 8096 and is file-system backed. All endpoints return JSON.

**Base URL:** `http://localhost:8096/api` (or deployed domain)

---

## Authentication

Set environment variable `DESIGN_API_KEY` to require authentication on write endpoints.

```bash
DESIGN_API_KEY=$(openssl rand -hex 32) npm run dev
```

All `POST`, `PUT`, `DELETE`, `PATCH` requests must include:

```
X-Api-Key: <value>
```

Read endpoints (`GET`, `HEAD`, `OPTIONS`) are always public.

**Response on auth failure:**
```json
{
  "error": "Unauthorized",
  "status": 401,
  "code": "UNAUTHORIZED"
}
```

---

## Error Response Format

All errors follow consistent shape:

```json
{
  "error": "Human-readable error message",
  "status": 400,
  "code": "ERROR_CODE"
}
```

Common codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `CONFLICT`, `INVALID_SVG`, `FILE_SYSTEM_ERROR`

---

## Brands

### List all brands

```
GET /api/brands
```

**Response:**
```json
[
  {
    "name": "Default",
    "slug": "default",
    "description": "Default brand"
  },
  {
    "name": "Acme Corp",
    "slug": "acme",
    "description": "ACME brand"
  }
]
```

### Get brand by slug

```
GET /api/brands/:slug
```

Returns full brand object with colors, fonts, spacing, shadows.

**Response:**
```json
{
  "name": "Default",
  "slug": "default",
  "description": "Default brand",
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
    "medium": {},
    "light": {},
    "neutral": {}
  }
}
```

### Get brand identity section

Portal endpoint. Returns colors, fonts, spacing, shadows only (no full config).

```
GET /api/brands/:slug/identity
```

**Response:**
```json
{
  "fonts": { ... },
  "spacing": { ... },
  "borderRadius": { ... },
  "shadows": { ... },
  "colors": { ... }
}
```

Disabled when `DISABLE_PORTAL=1`.

### Get brand colors

```
GET /api/brands/:slug/colors
```

Returns role-grouped color palette.

**Response:**
```json
{
  "primary": {
    "base": { "hex": "#1f2937", "rgb": [31, 41, 55], "role": "primary-background" },
    "light": { "hex": "#f3f4f6", "rgb": [243, 244, 246], "role": "primary-surface" }
  },
  "medium": { ... },
  "light": { ... },
  "neutral": { ... }
}
```

### Get brand logos

```
GET /api/brands/:slug/logos
```

Returns array of logo files.

**Response:**
```json
[
  {
    "name": "logo",
    "file": "brands/default/assets/logo.svg",
    "format": "svg",
    "size": "1.2 KB"
  },
  {
    "name": "logo-alt",
    "file": "brands/default/assets/logo-alt.svg",
    "format": "svg",
    "size": "0.8 KB"
  }
]
```

Disabled when `DISABLE_PORTAL=1`.

### Create brand logo

```
POST /api/brands/:slug/logos
Content-Type: multipart/form-data

file: (SVG file)
name: (optional, inferred from filename if omitted)
```

**Response:**
```json
{
  "name": "logo",
  "file": "brands/default/assets/logo.svg",
  "format": "svg",
  "size": "1.2 KB"
}
```

**Validation:**
- File must be valid SVG
- No `<script>` tags allowed
- No event handlers (`on*` attributes) allowed
- File size limit: 1 MB

### Get brand typography

```
GET /api/brands/:slug/typography
```

Returns fonts object.

**Response:**
```json
{
  "heading": "Georgia",
  "body": "Segoe UI",
  "mono": "Courier New"
}
```

Disabled when `DISABLE_PORTAL=1`.

### Update brand typography

```
PUT /api/brands/:slug/typography
Content-Type: application/json

{
  "heading": "Georgia",
  "body": "Segoe UI",
  "mono": "Courier New"
}
```

**Response:** Updated typography object.

### Get brand guidelines

```
GET /api/brands/:slug/guidelines
```

Returns parsed guidelines with frontmatter and sections.

**Response:**
```json
{
  "frontmatter": {
    "brand": "default",
    "version": "1.0",
    "last_updated": "2026-04-17"
  },
  "sections": [
    {
      "slug": "voice_tone",
      "title": "Voice & Tone",
      "content": "<p>Guidelines prose...</p>"
    },
    {
      "slug": "logo_usage",
      "title": "Logo Usage",
      "content": "<p>Logo guidance...</p>"
    }
  ]
}
```

Disabled when `DISABLE_PORTAL=1`.

### Update brand guidelines

```
PUT /api/brands/:slug/guidelines
Content-Type: application/json

{
  "frontmatter": {
    "brand": "default",
    "version": "1.0",
    "last_updated": "2026-04-17"
  },
  "content": "# Markdown prose..."
}
```

**Response:** Parsed guidelines object.

### Create brand

```
POST /api/brands
Content-Type: application/json

{
  "name": "New Brand",
  "slug": "new-brand",
  "description": "Description"
}
```

**Response:** Created brand object.

### Delete brand logo

```
DELETE /api/brands/:slug/logos/:logoName
```

**Response:** `{ "success": true }`

---

## Components

### List all components

```
GET /api/components
```

Returns registry of all components (or legacy manifest if `DISABLE_ENRICHED_COMPONENTS=1`).

**Response:**
```json
[
  {
    "name": "Button",
    "tier": "ui",
    "path": "src/components/ui/Button.tsx",
    "description": "Primary action button",
    "props": [
      { "name": "variant", "type": "string" },
      { "name": "size", "type": "string" }
    ],
    "variants": {
      "variant": ["default", "secondary"]
    },
    "examples": [
      {
        "label": "Default",
        "code": "<Button>Click me</Button>"
      }
    ]
  },
  ...
]
```

### Get component by name

```
GET /api/components/:name
```

Returns single component spec.

**Response:** Component object (same shape as above).

### Search components

```
GET /api/components/search?q=button
```

**Query params:**
- `q` (required) — search term

**Response:** Array of matching components.

---

## Icons

### List all icons

```
GET /api/icons
```

Returns paginated icon list.

**Query params:**
- `page` — page number (default: 0)
- `limit` — items per page (default: 50, max: 500)

**Response:**
```json
{
  "icons": [
    {
      "name": "account_circle",
      "styles": ["outlined", "rounded", "sharp"],
      "tags": ["profile", "user"]
    },
    ...
  ],
  "total": 2500,
  "page": 0,
  "limit": 50,
  "hasMore": true
}
```

Unavailable when `DISABLE_ICONS=1`.

### Get icon

```
GET /api/icons/:name/:style
```

Returns SVG content.

**Params:**
- `name` — icon name (e.g., `account_circle`)
- `style` — one of `outlined`, `rounded`, `sharp`

**Response:** Raw SVG content with `Content-Type: image/svg+xml`.

**Example:**
```
GET /api/icons/account_circle/outlined
```

Returns:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>
```

Unavailable when `DISABLE_ICONS=1`.

### Search icons

```
GET /api/icons/search?q=account
```

**Query params:**
- `q` (required) — search term (name or tag)
- `limit` (optional, default: 50)

**Response:**
```json
[
  {
    "name": "account_circle",
    "styles": ["outlined", "rounded", "sharp"]
  },
  {
    "name": "account_box",
    "styles": ["outlined", "rounded", "sharp"]
  }
]
```

---

## Templates

### List all templates

```
GET /api/templates
```

**Query params:**
- `category` (optional) — filter by category

**Response:**
```json
[
  {
    "name": "Hero",
    "category": "landing",
    "description": "Hero section template",
    "file": "templates/Hero.html",
    "props": { ... },
    "preview": "<img src='...' />"
  },
  ...
]
```

### Get template

```
GET /api/templates/:name
```

**Response:** Template object with full HTML content.

### Create template

```
POST /api/templates
Content-Type: application/json

{
  "name": "NewTemplate",
  "category": "landing",
  "description": "New template",
  "html": "<div>...</div>"
}
```

**Response:** Created template object.

### Update template

```
PUT /api/templates/:name
Content-Type: application/json

{
  "description": "Updated description",
  "html": "<div>...</div>"
}
```

**Response:** Updated template object.

### Delete template

```
DELETE /api/templates/:name
```

**Response:** `{ "success": true }`

---

## Assets

### List all assets

```
GET /api/assets
```

**Query params:**
- `category` (optional) — filter by category

**Response:**
```json
[
  {
    "name": "Logo Primary",
    "file": "assets/logo.svg",
    "category": "branding",
    "format": "svg",
    "size": "1.2 KB",
    "tags": ["brand", "logo"],
    "usage": "Primary brand logo"
  },
  ...
]
```

### Get asset

```
GET /api/assets/:name
```

**Response:** Asset metadata object.

### Upload asset

```
POST /api/assets
Content-Type: multipart/form-data

file: (SVG/PNG/JPG file)
name: (asset name)
category: (e.g., branding)
tags: (comma-separated, optional)
usage: (description, optional)
```

**Response:** Created asset object.

### Delete asset

```
DELETE /api/assets/:name
```

**Response:** `{ "success": true }`

---

## Search

### Cross-resource search

```
GET /api/search?q=button
```

**Query params:**
- `q` (required) — search term

**Response:**
```json
{
  "components": [ ... ],
  "templates": [ ... ],
  "icons": [ ... ]
}
```

---

## Import

### Bulk import HTML templates

```
POST /api/import
Content-Type: multipart/form-data

file: (ZIP containing .html files)
category: (template category)
overwrite: (true/false, optional)
```

**Response:**
```json
{
  "imported": 5,
  "failed": 0,
  "templates": [ ... ]
}
```

### Bulk import JSON brands

```
POST /api/import/brands
Content-Type: multipart/form-data

file: (ZIP containing brand.json files)
overwrite: (true/false, optional)
```

**Response:**
```json
{
  "imported": 3,
  "failed": 0,
  "brands": [ ... ]
}
```

---

## Preview

### Render template with data

```
POST /api/preview
Content-Type: application/json

{
  "html": "<div>{{title}}</div>",
  "data": {
    "title": "Hello World"
  }
}
```

**Response:** Rendered HTML string.

---

## Categories

### List categories

```
GET /api/categories
```

**Response:**
```json
{
  "templates": ["landing", "card", "hero"],
  "assets": ["branding", "icons", "patterns"]
}
```

---

## Rate Limiting

All endpoints are rate-limited:

**Read endpoints:** 1,000 requests per 15 minutes per IP
**Write endpoints:** 100 requests per 15 minutes per IP

**Response headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1713523200
```

When limit exceeded:
```json
{
  "error": "Too many requests, please try again later",
  "status": 429
}
```

---

## MCP Tools (Design System Server)

Run `npx tsx src/mcp/design-system-server.ts` to start the MCP server on stdio.

### 1. get_component

**Input:**
```json
{
  "name": "Button"
}
```

**Output:** Full component spec from registry.

### 2. search_components

**Input:**
```json
{
  "query": "button"
}
```

**Output:** Array of matching components.

### 3. get_asset

**Input:**
```json
{
  "name": "Logo Primary"
}
```

**Output:** Asset metadata.

### 4. get_tokens

**Input:**
```json
{
  "category": "colors"
}
```

**Output:** Design tokens by category.

### 5. get_composition_rules

**Input:**
```json
{
  "componentName": "Button"
}
```

**Output:** Composition constraints for the component.

### 6. get_brand_identity

**Input:**
```json
{
  "slug": "default"
}
```

**Output:** Brand colors, fonts, spacing, shadows.

### 7. get_brand_guidelines

**Input:**
```json
{
  "slug": "default"
}
```

**Output:** Parsed guidelines with frontmatter and sections.

### 8. get_component_spec

**Input:**
```json
{
  "name": "Button"
}
```

**Output:** Full component spec with props, variants, examples.

### 9. search_icons

**Input:**
```json
{
  "query": "account"
}
```

**Output:** Array of matching icons with styles.

### 10. get_icon

**Input:**
```json
{
  "name": "account_circle",
  "style": "outlined"
}
```

**Output:** SVG content.
