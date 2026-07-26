FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS base
RUN apk add --no-cache supervisor=4.3.0-r0 chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# REQ-087 / F-SUPPLY-01 — Supply-chain hardening gate.
# Fail the image build on any HIGH or CRITICAL advisory against production
# deps. If a known-unfixable advisory is temporarily accepted, document the
# CVE in docs/third-party-review.md and narrow the gate to --audit-level=critical
# only for that deploy window.
RUN npm audit --audit-level=high --production || \
    (echo "[security] npm audit surfaced HIGH or CRITICAL advisories — build blocked." && exit 1)

COPY . .

# NEXT_PUBLIC_* env vars are inlined into the client bundle at build time, so
# they MUST be available during `next build`, not just at runtime. The
# docker-compose `environment:` block is runtime-only; the matching `args:`
# block forwards the value here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npx next build
RUN cp -r .next/static .next/standalone/.next/static
RUN cp -r public .next/standalone/public 2>/dev/null || true

# REQ-082 / REQ-091 — create data directories (so empty volume mounts do
# not fail) and chown to the non-root runtime user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
RUN mkdir -p /app/templates /app/brands /app/assets /app/icons && \
    chown -R nextjs:nodejs /app/templates /app/brands /app/assets /app/icons

COPY supervisord.conf /etc/supervisord.conf
EXPOSE 8095 8096

# REQ-091 / F-DOCKER-01 — run as non-root. `nextjs` is UID 1001 created
# above. Host-mounted volumes in docker-compose.yml (icons/, brands/,
# templates/, assets/) must be writable by UID 1001 on Linux; Docker
# Desktop handles UID mapping on macOS.
USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8096/api/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
