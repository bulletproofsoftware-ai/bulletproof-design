# Deployment Guide

Design Library deploys as a single Docker container with two processes (Next.js and Express) orchestrated via supervisord.

---

## Environment Variables

### Core Settings

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `development` | No | Set to `production` for CSP hardening and optimizations |
| `PORT` | `8096` | No | Express API port |
| `DESIGN_API_KEY` | unset | No* | API key for write endpoints; required in production |
| `GITHUB_TOKEN` | unset | No | GitHub API token for `npm run icons:sync` (raises rate limits) |

*Required in production for security; optional in development.

### Feature Flags

| Variable | Default | Effect when set to `1` |
|----------|---------|------------------------|
| `DISABLE_PORTAL` | `0` | Portal pages return 404; portal-specific API endpoints blocked |
| `DISABLE_ICONS` | `0` | Icon routes unmounted; `/icons` page shows empty state |
| `DISABLE_ENRICHED_COMPONENTS` | `0` | Legacy 14-item component manifest returned instead of enriched registry |
| `PORTAL_INDEX` | unset | Set to `1` to allow search engine indexing on portal pages (use only on production with approval) |

Startup-scoped flags (`DISABLE_ICONS`, `DISABLE_ENRICHED_COMPONENTS`) require container restart.

### Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPLATES_DIR` | `./templates` | Location of HTML template files |
| `BRANDS_DIR` | `./brands` | Location of brand configs and guidelines |
| `ASSETS_DIR` | `./assets` | Location of asset files (logos, etc.) |
| `ICONS_DIR` | `./icons/material-symbols` | Location of Material Symbols icon SVGs |

### CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `http://localhost:8095` | Comma-separated list of allowed origins (production only) |

Development mode allows all origins.

---

## Docker Volumes

Mount these directories to persist data across container restarts:

```yaml
volumes:
  - ./brands:/app/brands                       # Brand configs + guidelines + logos
  - ./templates:/app/templates                 # HTML templates
  - ./assets:/app/assets                       # Asset files
  - ./icons/material-symbols:/app/icons/material-symbols  # Icons
```

**Example docker-compose.yml:**

```yaml
version: '3.8'

services:
  design:
    build: .
    ports:
      - "8095:8095"    # Next.js
      - "8096:8096"    # Express API
    environment:
      NODE_ENV: production
      DESIGN_API_KEY: ${DESIGN_API_KEY}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      CORS_ORIGIN: https://design.example.com
    volumes:
      - ./brands:/app/brands
      - ./templates:/app/templates
      - ./assets:/app/assets
      - ./icons:/app/icons
    restart: unless-stopped
```

---

## Dockerfile

Production Docker image with multi-stage build:

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install supervisord
RUN apk add --no-cache supervisor

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --production

# Run security audit (HIGH threshold)
RUN npm run audit:check || exit 1

# Copy application code
COPY . .

# Build Next.js
RUN npm run build

# Generate design tokens (required for Next.js)
RUN npm run generate:tokens

# Create non-root user
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 nextjs

# Set permissions for non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

# supervisord config
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 8095 8096

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

**Key points:**
- Alpine-based for minimal image size
- supervisord for process orchestration
- Non-root user (nextjs) for security
- `npm run audit:check` gate fails build on HIGH/CRITICAL advisories
- `npm run generate:tokens` required for Next.js build
- File permissions set for non-root user

### supervisord Configuration

**File:** `supervisord.conf`

```ini
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:next]
command=npm run start
directory=/app
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stdout
stderr_logfile_maxbytes=0
autorestart=true

[program:api]
command=npm run api
directory=/app
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stdout
stderr_logfile_maxbytes=0
autorestart=true
```

---

## Security Considerations

### Authentication

In production, always set `DESIGN_API_KEY`:

```bash
export DESIGN_API_KEY=$(openssl rand -hex 32)
docker compose up
```

This requires all write endpoints to include:
```
X-Api-Key: <value>
```

### Content Security Policy

**Production CSP (NODE_ENV=production):**

```
script-src 'self' 'nonce-{random}' 'strict-dynamic'
style-src 'self' 'unsafe-inline'
font-src 'self' https://fonts.gstatic.com
img-src 'self' data:
connect-src 'self'
default-src 'self'
```

- No inline scripts (`'unsafe-inline'` removed from script-src)
- Nonce-based for dynamic scripts
- Strict-dynamic enforces CSP for dynamically loaded scripts

**Development CSP (NODE_ENV=development):**

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

Retains unsafe directives for HMR and Monaco editor.

### Supply Chain

**Security audit gate:**

```bash
npm run audit:check
```

Fails the build if any HIGH or CRITICAL advisories exist in production dependencies.

Also runs inside Docker build:
```dockerfile
RUN npm run audit:check || exit 1
```

**SBOM generation:**

```bash
npm run sbom:generate
```

Produces `sbom.cdx.json` in CycloneDX 1.5 format for supply chain audit.

### SVG Sanitization

All uploaded SVGs are sanitized using `sanitize-html`:

- No `<script>` tags allowed
- No event handlers (`on*` attributes)
- No external entity references (XXE prevention)
- File size limit: 1 MB

Applies to:
- Logo uploads (`POST /api/brands/:slug/logos`)
- Icon sync from GitHub (`npm run icons:sync`)

---

## Deployment Steps

### 1. Pre-deployment Checklist

- [ ] All tests passing: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Security audit passes: `npm run audit:check`
- [ ] SBOM generated: `npm run sbom:generate`
- [ ] Environment variables configured
- [ ] Data volumes mounted
- [ ] API key generated and secured

### 2. Build Docker Image

```bash
docker compose build --no-cache
```

### 3. Start Container

**Development:**
```bash
docker compose up
```

**Production:**
```bash
DESIGN_API_KEY=$(openssl rand -hex 32) docker compose up -d
```

### 4. Verify Services

```bash
# Next.js app
curl http://localhost:8095

# Express API
curl http://localhost:8096/api/brands

# With API key
curl -H "X-Api-Key: $DESIGN_API_KEY" http://localhost:8096/api/brands
```

### 5. Generate Icons (Optional)

If `icons/` directory is empty:

```bash
docker compose exec design npm run icons:sync
```

Alternatively, set `GITHUB_TOKEN` to raise API rate limits:

```bash
GITHUB_TOKEN=$(gh auth token) npm run icons:sync
```

### 6. Migrate Brands (If Upgrading)

If upgrading from flat JSON brands to directory format:

```bash
docker compose exec design npm run brands:migrate
```

---

## Post-deployment Verification

### Health Checks

```bash
# Next.js health
curl http://localhost:8095/api/health || echo "health check endpoint not implemented"

# API health (list brands)
curl http://localhost:8096/api/brands

# Portal page
curl http://localhost:8095/portal/default | head -50
```

### Data Validation

```bash
# Check brand directory structure
ls -la ./brands/default/
# Expected:
# - brand.json
# - guidelines.md
# - assets/ (directory)

# Check icon count
find ./icons/material-symbols -name "*.svg" | wc -l
# Expected: ~7,500+ (3 styles × ~2,500 icons)

# Check component registry
curl http://localhost:8096/api/components | jq '.length'
```

### Log Monitoring

```bash
# View container logs
docker compose logs -f

# View specific service
docker compose logs -f design
```

---

## Backup & Restore

### Backup Data

```bash
# Backup brands directory
tar -czf brands-backup-$(date +%Y%m%d_%H%M%S).tar.gz ./brands

# Backup all data volumes
tar -czf design-data-backup-$(date +%Y%m%d_%H%M%S).tar.gz \
  ./brands ./templates ./assets ./icons
```

### Restore Data

```bash
# Restore from backup
tar -xzf brands-backup-YYYYMMDD_HHMMSS.tar.gz

# Restart container
docker compose restart design
```

---

## Scaling & Performance

### Container Resource Limits

```yaml
services:
  design:
    resources:
      limits:
        cpus: '1'
        memory: '1G'
      reservations:
        cpus: '0.5'
        memory: '512M'
```

### Environment Optimizations

For high-traffic deployments:

```bash
# Increase file descriptor limit
ulimit -n 65536

# Enable Node.js memory optimization
export NODE_OPTIONS="--max-old-space-size=1024"
```

### Rate Limiting Configuration

Embedded in Express middleware (src/api/server.ts):
- **Read endpoints:** 1,000 req/15min per IP
- **Write endpoints:** 100 req/15min per IP

Adjust in code if needed for different SLAs.

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker compose logs design
```

**Common causes:**
- Port 8095 or 8096 already in use
- Missing volumes
- Invalid `DESIGN_API_KEY`

**Solution:**
```bash
# Kill existing processes
lsof -i :8095 -i :8096 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Restart
docker compose up
```

### Out of Memory

**Symptoms:** Process restarts frequently

**Solution:**
```bash
# Increase memory limit in docker-compose.yml
memory: '2G'

# Or restart container
docker compose restart design
```

### Icon Sync Fails

**Symptoms:** `DISABLE_ICONS=1` but want to populate icons

**Check GitHub rate limits:**
```bash
gh api rate_limit --jq '.rate'
```

**Increase limits:**
```bash
GITHUB_TOKEN=$(gh auth token) npm run icons:sync
```

### Portal Pages Show 404

**Check feature flag:**
```bash
echo $DISABLE_PORTAL  # Should be empty or 0
```

**If set to 1:**
```bash
unset DISABLE_PORTAL
docker compose restart design
```

---

## Monitoring & Observability

### Audit Logging

All write operations logged to stdout:
```
[audit] 2026-04-17T12:00:00.000Z POST /api/brands/default/logos from 203.0.113.5
```

Collect with ELK, Datadog, or similar.

### Request Metrics

Express outputs:
- RateLimit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- Response times in headers
- HTTP status codes in logs

### Health Monitoring

```bash
# Liveness check (API endpoint responds)
curl -f http://localhost:8096/api/brands || exit 1

# Readiness check (data volumes accessible)
test -d ./brands && test -d ./templates && test -d ./assets
```

---

## Version Upgrades

### Pre-upgrade Steps

1. Generate SBOM of current version
2. Backup all data volumes
3. Note current `npm audit` status
4. Test in staging environment first

### Upgrade Process

```bash
# Pull latest
git pull origin main

# Rebuild image
docker compose build --no-cache

# Stop old container
docker compose down

# Start new container
docker compose up -d

# Verify
curl http://localhost:8096/api/brands
```

### Post-upgrade Steps

1. Verify all data volumes still accessible
2. Run brand migration if needed: `npm run brands:migrate`
3. Check logs for errors: `docker compose logs design`
4. Update SBOM: `npm run sbom:generate`

---

## Production Checklist

- [ ] `NODE_ENV=production` set
- [ ] `DESIGN_API_KEY` generated and stored in secrets manager
- [ ] CSP headers configured in middleware.ts
- [ ] Rate limiting thresholds reviewed and adjusted if needed
- [ ] HTTPS proxy (nginx/HAProxy) in front of port 8096
- [ ] Data volumes on persistent storage (not ephemeral)
- [ ] Backup policy in place (daily snapshots)
- [ ] Monitoring/alerting configured (container health, disk usage)
- [ ] CORS origin set correctly
- [ ] Audit logging piped to central log collector
- [ ] SBOM generated and versioned with release
