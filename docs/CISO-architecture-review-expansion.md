# CISO Architecture Security Review — Design Library Expansion

**Review Type:** Pre-implementation architecture review (MAJOR-tier)
**Date:** 2026-04-17
**Reviewer:** conductor-ciso
**Project:** Design Library Expansion (Brand Portal + Component Spec Browser + Icon Library)
**Scope:** SPEC-001 through SPEC-014 + existing middleware, server.ts, BRD-tracker.json
**Framework References:** OWASP Top 10 2025 (Web), OWASP API Top 10 2023, NIST SSDF SP 800-218 v1.1, CISA SBOM 2025

---

## Executive Summary

### Overall Verdict: **APPROVED WITH CONDITIONS**

The architecture demonstrates a **strong security posture** for a greenfield-admin / public-portal hybrid. The major decisions are correct:

1. **Client-side JSX playground** (SPEC-008) correctly rejects the server-side POST-preview RCE vector — this is the highest-impact decision in the entire expansion.
2. **SVG upload pipeline** (SPEC-004) layers pre-write sanitization, read-time defensive rejection, and MIME/size caps — three independent controls.
3. **Path-traversal guards** (SPEC-003, SPEC-004) use `path.resolve` + `startsWith` correctly.
4. **Route-group isolation** (SPEC-006) ensures admin chrome cannot leak into public portal pages.

However, **13 conditional findings** must be addressed before implementation begins. Six are HIGH severity (MUST fix), seven are MEDIUM. These are not deal-breakers — they are gaps in otherwise-solid specs.

### Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | — |
| High | 6 | MUST resolve during implementation |
| Medium | 7 | SHOULD resolve during implementation |
| Low | 4 | RECOMMENDED |
| Informational | 3 | FYI |

### Compliance Status

| Framework | Status | Notes |
|-----------|--------|-------|
| OWASP Top 10 2025 (Web) | ⚠️ PARTIAL | A01, A03, A05, A10 need reinforcement (see findings) |
| OWASP API Top 10 2023 | ✅ PASS | Authorization, resource consumption, injection all addressed |
| OWASP LLM Top 10 | N/A | No LLM surface in expansion |
| NIST SSDF | ⚠️ PARTIAL | PW.6 (build security), PW.8 (testing) have gaps (SPEC-013 addresses most) |
| Supply Chain | ⚠️ PARTIAL | SBOM not generated; new deps not pinned/verified (see F-SUPPLY-01) |
| Container Security | ⚠️ PARTIAL | SPEC-014 ok; non-root user enforcement not documented in Dockerfile review |

---

## 1. Architecture Threat Surface

The expansion adds these new security surfaces on top of the existing brownfield codebase:

| # | Surface | Auth | Trust Boundary | Risk Class |
|---|---------|------|---------------|------------|
| 1 | `/portal/:slug/*` public pages | **None** (public) | Internet → Next.js | Information disclosure, DoS |
| 2 | `POST /api/brands/:slug/logos` (SVG multipart) | API key | Anonymous admin → Express → filesystem | RCE via SVG, path traversal, DoS |
| 3 | `DELETE /api/brands/:slug/logos/:key` | API key | Authenticated admin → filesystem | Destructive; lower risk |
| 4 | `PUT /api/brands/:slug/guidelines` (markdown) | API key | Authenticated admin → filesystem | Stored XSS via rendered HTML |
| 5 | `GET /brand-assets/:slug/:file` (static SVG) | **None** (public) | Internet → filesystem | Stored XSS, path traversal |
| 6 | `GET /api/icons/:name/svg` | **None** (public) | Internet → filesystem | Stored XSS (if ingestion not trusted) |
| 7 | Client-side `@babel/standalone` playground | — | Admin user → browser sandbox | Isolated; low risk with correct sandbox |
| 8 | Iframe variant previews | **None** | Parent → API-served HTML | Clickjacking, XSS in preview |
| 9 | Guidelines rendered HTML output | — | Stored markdown → portal DOM | Stored XSS via markdown-it |
| 10 | Icons sync from GitHub (ingestion) | — | GitHub raw → filesystem | Supply chain, unsigned payload |

---

## 2. STRIDE Threat Model

### Data-Flow Diagram (textual)

```
[Anonymous Portal User]
    │
    ▼ HTTP GET /portal/:slug/*
[Next.js :8095] ────► [Express :8096]
    │                      │
    │                      ▼
    │                 [File System]
    │                  brands/<slug>/
    │                  icons/material-symbols/
    │
[Admin User w/ API key]
    │
    ▼ HTTPS + X-Api-Key (in localStorage)
[Express :8096 write routes] ──► [File System writes]
                                    │
                                    ▼
                              [Audit log (console)]

[Icons Sync Script]
    │
    ▼ HTTPS (GITHUB_TOKEN optional)
[raw.githubusercontent.com] ──► [icons/ filesystem]

[MCP Server process]
    │
    ▼ stdio
[Claude Code] ──► file-system read-only access
```

### STRIDE Findings by Element

| ID | Element | Threat | Category | Impact | Likelihood | Risk | Mitigation | Status |
|----|---------|--------|----------|--------|-----------|------|------------|--------|
| T-001 | Portal pages | Anonymous enumeration of all brand slugs | **I** | Low | High | Medium | Rate-limit `GET /portal/*`; optional slug allowlist | Gap — see F-PORTAL-01 |
| T-002 | Portal pages | Amplification DoS via unrestricted `GET /api/brands/:slug/identity` | **D** | Medium | Medium | Medium | Read rate limit exists (1000/15min) but per-IP is insufficient for public exposure | Gap — see F-PORTAL-02 |
| T-003 | Logo upload | Stored XSS via SVG `<script>` tags | **T/E** | High | High | **High** | Pre-write sanitization + read-time defensive check + static-served `Content-Type` + `nosniff` | Covered (SPEC-004) — verify library choice, see F-UPLOAD-01 |
| T-004 | Logo upload | SVG with external entity expansion (XXE) | **I/D** | Medium | Low | Medium | SVG sanitizer must strip DOCTYPE / ENTITY | Gap — see F-UPLOAD-02 |
| T-005 | Logo upload | Path traversal in `filename` override | **T** | High | Low | Medium | `sanitize-filename` + path.resolve assert | Covered (SPEC-004) |
| T-006 | Logo upload | ZIP-bomb / compression bomb SVG | **D** | Medium | Low | Low | 5 MB size cap + SVG is not compressed; low risk | Covered (SPEC-004) |
| T-007 | Logo upload | Overwrite existing critical file via filename collision | **T** | Medium | Medium | Medium | Current spec "overwrites with warning" — should use content-addressable filenames or explicit confirm | Gap — see F-UPLOAD-03 |
| T-008 | Logo upload | Race condition: concurrent uploads corrupt `brand.json` | **T** | Medium | Low | Low | Atomic rename on brand.json; but no lock around read-modify-write | Gap — see F-UPLOAD-04 |
| T-009 | Guidelines PUT | Stored XSS via markdown-it rendered HTML | **T/E** | High | High | **High** | `html:false` + sanitize-html allowlist (SPEC-002) | Covered (SPEC-002) — verify sanitizer scope, see F-GUIDE-01 |
| T-010 | Guidelines PUT | Admin key exfiltration via browser XSS on admin UI | **E** | Critical | Low | Medium | API key in localStorage accessible to any XSS; see F-AUTH-01 | Gap — see F-AUTH-01 |
| T-011 | Guidelines PUT | CSRF via credentialed cookie on POST/PUT | **S** | Medium | Low | Low | API key in header (not cookie); CORS `credentials:true` but same-origin only in prod | Mostly OK — see F-AUTH-02 |
| T-012 | Static `/brand-assets` | Path traversal via URL-decoded `..` | **T** | High | Low | Medium | Slug regex + file regex + path.resolve assert | Covered (SPEC-004) — verify decode order, see F-STATIC-01 |
| T-013 | Static `/brand-assets` | Serving arbitrary MIME via extension confusion | **T** | Medium | Low | Low | Extension allowlist + `X-Content-Type-Options: nosniff` | Covered |
| T-014 | Static `/brand-assets` | SVG sanity-on-read bypass (file uploaded before sanitizer rolled out) | **T/E** | High | Medium | **High** | Read-time defensive scan for `<script>` / `on*=` | Covered (SPEC-004) — but brittle regex; see F-STATIC-02 |
| T-015 | Icon SVG serving | Stored XSS in icon SVG (Material Symbols is trusted but supply chain) | **T/E** | High | Low | Medium | Sync script pre-validates + read-time defensive scan | Covered (SPEC-003) — verify sanitizer runs on ingest, see F-ICON-01 |
| T-016 | Icon sync script | Compromised GitHub release serves malicious SVGs | **T** | Medium | Low | Low | HTTPS + known-repo + fixed path; no checksum verification | Gap — see F-ICON-02 |
| T-017 | Component preview iframe | Clickjacking of admin UI via preview iframe | **S/T** | Low | Low | Low | `frame-src` CSP + `X-Frame-Options: SAMEORIGIN` on Next.js; preview served from :8096 | OK |
| T-018 | Playground `srcdoc` iframe | Escape `sandbox="allow-scripts"` via `allow-same-origin` mistake | **E** | Critical | Low | Medium | SPEC-008 explicitly forbids `allow-same-origin` in playground | Covered — needs regression test, see F-PLAY-01 |
| T-019 | Playground iframe | Malicious JSX snippet from clipboard executes in sandbox | **E** | Low | Medium | Low | Sandbox isolates from parent origin/cookies | OK — but document for user-generated content if playground accepts URL imports |
| T-020 | Playground iframe | Network exfiltration from inside sandboxed iframe | **I** | Medium | Medium | Medium | Sandbox `allow-scripts` still allows `fetch()` to third-party origins unless CSP `frame-src` restricts | Gap — see F-PLAY-02 |
| T-021 | API auth | `DESIGN_API_KEY` optional in dev → forgotten in production | **E** | Critical | Low | Medium | `validateApiKeyConfig()` hard-exits in production | Covered |
| T-022 | API auth | Single shared API key = no per-user attribution | **R** | Medium | High | Medium | Current audit log uses IP only; no user identity | Gap — see F-AUDIT-01 |
| T-023 | Audit log | Log injection via user-controlled slug/label | **R** | Low | Medium | Low | Current `console.log` format; no CRLF injection filter | Gap — see F-AUDIT-02 |
| T-024 | Audit log | No tamper-resistant storage; logs in stdout only | **R** | Medium | High | Medium | Acceptable for design-library scope; document | Informational |
| T-025 | MCP server | Path traversal via `name` param in `get_icon` | **T** | Medium | Low | Low | Zod regex `/^[a-z0-9_]+$/` blocks `.` and `/` | Covered (SPEC-012) |
| T-026 | MCP server | Information disclosure: returns SVG content (potentially XSS-laden) to LLM | **I** | Low | Low | Low | SVG goes to Claude Code, not rendered by LLM; downstream risk if LLM writes SVG to webpage | Informational — see F-MCP-01 |
| T-027 | Brand index | ReDoS via crafted slug passing through multiple regexes | **D** | Low | Low | Low | Regexes are anchored and simple; no catastrophic backtracking | OK |
| T-028 | Feature flag | `DISABLE_PORTAL=1` bypass via direct API call to `/api/brands/:slug/identity` | **I** | Medium | High | Medium | Flag only gates Next.js portal; API still public | Gap — see F-FLAG-01 |
| T-029 | Robots / SEO | Staging portal indexed because `PORTAL_NOINDEX` not set | **I** | Medium | Medium | Medium | Default is `index,follow`; reversed from secure-by-default | Gap — see F-PORTAL-03 |
| T-030 | Global CSP | `script-src 'unsafe-inline'` in production middleware.ts | **E** | High | Medium | **High** | Tailwind-JIT and Next.js do not require `unsafe-inline` scripts in production | Gap — see F-CSP-01 |

---

## 3. OWASP Top 10 2025 (Web) Mapping

| OWASP Category | Coverage | Evidence | Gaps |
|---|---|---|---|
| **A01: Broken Access Control** | ⚠️ Partial | `requireApiKey` on writes; portal is intentionally public. | F-FLAG-01: API still exposes `/api/brands/*` reads when portal is flagged off. F-AUTH-01: shared API key → no per-user authz. |
| **A02: Cryptographic Failures** | ✅ Covered | `timingSafeEqual` for key comparison. No credential storage. | Document that API key is sent in cleartext to `http://localhost:8096` — acceptable because container-internal, but production deploy behind TLS must be documented. |
| **A03: Injection** | ✅ Covered | Parameterized file paths; slug/name regexes; markdown-it with `html:false`; sanitize-html for rendered body; sanitize-svg for uploads. | F-GUIDE-01: Verify sanitize-html allowlist actually runs on markdown-it output (not just input). F-UPLOAD-02: XXE. F-STATIC-02: defensive regex. |
| **A04: Insecure Design** | ✅ Covered | Client-side playground decision rejects RCE vector; read-modify-write atomicity on brand.json; explicit auth decision (publicAccess vs requireApiKey). | F-UPLOAD-04: RMW race. F-UPLOAD-03: filename collision policy. |
| **A05: Security Misconfiguration** | ⚠️ Partial | Helmet on Express; CSP on Next.js; feature flags. | F-CSP-01: `unsafe-inline` scripts in production CSP. F-DOCKER-01: non-root user enforcement not verified. |
| **A06: Vulnerable & Outdated Components** | ⚠️ Partial | Existing `npm audit` in CI assumed. | F-SUPPLY-01: New deps (`multer`, `@mattkrick/sanitize-svg`, `@babel/standalone`, `gray-matter`, `markdown-it`) not version-pinned in specs; no SBOM step. |
| **A07: Identification & Authentication Failures** | ⚠️ Partial | API key w/ timing-safe compare. | F-AUTH-01: localStorage key exposure to any XSS. No MFA, no rotation, no per-user auth. Acceptable for single-operator admin but document. |
| **A08: Software & Data Integrity Failures** | ⚠️ Partial | Atomic writes; no signed artifacts. | F-ICON-02: icon sync has no SHA-256 verification. F-SUPPLY-01: no SBOM. |
| **A09: Security Logging & Monitoring Failures** | ⚠️ Partial | `auditLog('logos.uploaded', ...)` and similar events. | F-AUDIT-01: no user identity. F-AUDIT-02: no log-injection hardening. T-024: stdout-only. |
| **A10: SSRF** | ✅ Covered | `sanitizeUrl` in `src/api/lib/sanitize.ts` blocks private IPs, DNS rebinding, credentials; icons sync uses hardcoded `raw.githubusercontent.com` path (not user-controlled). | Re-verify `sanitizeUrl` is used by import route — not new in this expansion but adjacent. |

---

## 4. Findings — Detailed

### HIGH Severity (Must Resolve)

#### F-UPLOAD-01: SVG sanitizer library must strip on upload-path AND on ingestion path
**Severity:** HIGH
**OWASP:** A03 Injection / Stored XSS
**STRIDE:** T-003
**Specs affected:** SPEC-004
**Finding:** SPEC-004 specifies `@mattkrick/sanitize-svg` but does not require the sanitizer to strip: `<foreignObject>`, `<use href="...">` pointing to external URLs, `xlink:href="javascript:"`, CSS `url(javascript:...)` inside `<style>`, and inline event handlers in namespaced forms (`onclick`, `onmouseover`, etc., possibly via attribute aliases).
**Requirement:** The SVG sanitizer MUST:
1. Strip all `<script>` elements (any namespace).
2. Strip all attributes starting with `on*` (case-insensitive).
3. Strip `xlink:href` / `href` values starting with `javascript:`, `data:` (except `data:image/*`), or `vbscript:`.
4. Strip `<foreignObject>` entirely (allows HTML injection inside SVG).
5. Strip `<use>` elements whose `href` points to external origins.
6. Strip `<style>` elements (CSS can execute via `url(javascript:)` and `expression()` in IE — defense in depth).
7. Strip DOCTYPE declarations and `<!ENTITY>` blocks (XXE).
**Action:** Document the sanitizer requirement as a checklist in SPEC-004 and add unit tests for each bypass. If `@mattkrick/sanitize-svg` does not strip all of these, evaluate `DOMPurify` with `USE_PROFILES: { svg: true, svgFilters: true }` as an alternative.
**Verification:** Unit tests must include payloads from OWASP SVG XSS cheatsheet.

#### F-GUIDE-01: Markdown→HTML sanitization must run AFTER render, not just disable raw HTML
**Severity:** HIGH
**OWASP:** A03 Injection / Stored XSS
**STRIDE:** T-009
**Specs affected:** SPEC-002
**Finding:** SPEC-002 says `markdown-it` is configured with `html:false` — this prevents raw `<script>` passthrough from markdown input, but markdown-it still emits `<a href="...">` from `[text](url)` syntax. An admin-authored markdown could include `[click](javascript:alert(1))` and the rendered anchor will carry `javascript:` URL. Additionally, CommonMark allows some HTML-like constructs (autolinks, image references with data URIs).
**Requirement:** Post-render sanitization MUST:
1. Pipe rendered HTML through `sanitize-html` (not just rely on `html:false`).
2. Allowlist: `a`, `p`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `pre`, `blockquote`, `img`, `br`.
3. Allow `href` only for `http:`, `https:`, `mailto:`. Block `javascript:`, `data:` (except `data:image/*`), `vbscript:`.
4. Strip all `on*=` attributes.
5. Allow `src` on `<img>` only for `http:`, `https:`, relative paths under `/brand-assets/`.
**Action:** Add a post-render sanitizer step to `parseGuidelines` when `renderHtml:true`. Add unit tests for javascript-URL anchors, data-URI images, and nested `<script>`.

#### F-STATIC-02: Defensive SVG-on-read scan uses brittle regex
**Severity:** HIGH
**OWASP:** A03 / A04
**STRIDE:** T-014
**Specs affected:** SPEC-004
**Finding:** The spec says "reject if file contains `<script>` or `on*=`" as a simple string scan. This will miss:
- `<script\t>` or `<script\n>` (whitespace after tag name)
- `<SCRIPT>` (case)
- HTML-encoded `&lt;script&gt;` (in CDATA or between attributes — rare but possible)
- `<svg onload="...">` without space, or with `onload\t=`.
**Requirement:** Either (a) re-run full SVG sanitization on read (slower but correct) or (b) use a robust regex test with `/i` flag: `/<script[\s>/]/i`, `/\son[a-z]+\s*=/i`. Prefer (a) for defense in depth — the CPU cost on a rarely-hit read path is negligible.
**Action:** Change SPEC-004 to sanitize-on-read using the same sanitizer as upload. Cache sanitized bytes to disk on first read if perf matters.

#### F-AUTH-01: API key stored in localStorage is exfiltrable via any XSS in admin UI
**Severity:** HIGH
**OWASP:** A07 / A05
**STRIDE:** T-010
**Specs affected:** SPEC-007, SPEC-010
**Finding:** SPEC-007 specifies storing `design-api-key` in localStorage and SPEC-010 reads it in `buildAuthHeaders`. Any XSS in the admin UI (e.g., stored XSS from a brand description, or a future admin-rendered field) grants full write access to all brands. Markdown sanitization (F-GUIDE-01) and SVG sanitization (F-UPLOAD-01) are the only barriers.
**Requirement:** Either:
1. Move API key to httpOnly cookie (preferred; requires server-side auth route — out of scope), OR
2. Accept the risk in writing: document in SPEC-007 that admin UI is trusted and that any stored content rendered in admin views MUST pass the same sanitization as portal views.
3. Ensure the admin UI NEVER renders user-controlled HTML without the markdown/SVG sanitizer pipeline.
**Action:** Add an explicit "admin UI trust assumption" note to SPEC-007. Audit every admin page for unsanitized brand-content rendering (especially the Monaco editor output preview and LogosTab label/usage fields — these are plaintext-only per spec, but confirm).

#### F-CSP-01: Production CSP includes `'unsafe-inline'` for scripts
**Severity:** HIGH
**OWASP:** A05
**STRIDE:** T-030
**Specs affected:** `middleware.ts` (existing, not modified by expansion but re-validated per REQ-081)
**Finding:** Current `middleware.ts` emits `script-src 'self' 'unsafe-inline'` in BOTH dev and prod. Only `'unsafe-eval'` is dev-only. Modern Next.js (15+) supports nonce-based CSP without `'unsafe-inline'` for scripts — see `next.config.ts` `experimental.strictNextHead` and Next.js middleware nonce generation patterns.
**Requirement:** In production (`NODE_ENV === 'production'`), remove `'unsafe-inline'` from `script-src`. Use nonce-based CSP. If nonce-based CSP breaks Tailwind JIT or shadcn components, document the specific blocker and re-evaluate.
**Action:** SPEC-014 REQ-081 verification step MUST include a task to remove `'unsafe-inline'` scripts in production and demonstrate the site renders without violations. If the team cannot remove it, document WHY and note this as accepted risk.
**Note:** `'unsafe-inline'` in `style-src` is common for Tailwind and is lower risk (no script execution). Keep it, but document.

#### F-SUPPLY-01: No SBOM generation; new dependencies not audited
**Severity:** HIGH
**OWASP:** A06, A08
**NIST SSDF:** PS.3, PW.4
**Specs affected:** SPEC-002, SPEC-003, SPEC-004, SPEC-008
**Finding:** The expansion adds ~10 new npm dependencies:
- `multer`, `@types/multer`, `@mattkrick/sanitize-svg`, `sanitize-filename` (SPEC-004)
- `gray-matter`, `markdown-it`, `@types/markdown-it`, `sanitize-html` (SPEC-002)
- `@babel/standalone` (SPEC-008 — large, known transitive-dep surface)
- `ajv`, `ajv-formats`, `p-limit` (SPEC-003)
- `@tanstack/react-virtual` (SPEC-009)

No spec requires:
- Version pinning with lockfile verification.
- `npm audit` in CI with failure on CRITICAL/HIGH.
- SBOM (CycloneDX or SPDX) generation at build time.
- Verification that `@mattkrick/sanitize-svg` is actively maintained (last publish check).
- Supply-chain attack scanning (Socket.dev, Snyk, GitHub Dependabot alerts).
**Requirement:** Add to SPEC-014 or SPEC-013:
1. `npm audit --audit-level=high` as a CI gate; failures block merge.
2. SBOM generation via `syft` on the final Docker image: `syft design-library:latest -o cyclonedx-json > sbom.cdx.json`.
3. Pin all new deps to exact versions (not `^`) until the first release.
4. Document each new dep's rationale and maintenance status in `docs/third-party-review.md` (new file, optional).
5. Enable Dependabot on the repo (already done? verify).
**Action:** Create `docs/TODO/SHARED-supply-chain-hardening.md` new TODO.

---

### MEDIUM Severity (Should Resolve)

#### F-UPLOAD-02: Explicit XXE prevention in SVG ingestion
**Severity:** MEDIUM
**OWASP:** A03
**STRIDE:** T-004
**Specs affected:** SPEC-004
**Finding:** SVG files can contain `<!DOCTYPE svg [<!ENTITY foo SYSTEM "file:///etc/passwd">]>` and the SVG parser (if used) may resolve external entities. Even though we don't parse SVG server-side (we sanitize as a DOM), if the sanitizer uses an XML parser internally, it may be vulnerable.
**Requirement:** Confirm the chosen sanitizer does NOT resolve external entities. Add an explicit test payload: an SVG with `<!DOCTYPE` + external entity reference. Expected result: DOCTYPE stripped, file written without reference.
**Action:** Document in SPEC-004 acceptance tests.

#### F-UPLOAD-03: Filename collision "overwrite with warning" policy is unsafe
**Severity:** MEDIUM
**OWASP:** A04
**STRIDE:** T-007
**Specs affected:** SPEC-004
**Finding:** SPEC-004 says `If file with same name exists → overwrite, but log a warning.` An admin could accidentally (or maliciously) upload a new SVG with the same filename as an existing logo, silently replacing it. The only trail is a log line. Worse, the current `brand.json` entry continues to point to the filename, so the displayed logo changes silently.
**Requirement:** One of:
1. **Content-addressable filename:** compute SHA-256 of sanitized bytes, use first 12 hex chars as suffix: `horizontal-a1b2c3d4e5f6.svg`. Collisions impossible. Old files remain on disk (orphan cleanup later).
2. **Explicit confirm parameter:** `POST` must include `overwrite:true` form field when an existing file with same name is present, else return 409.
**Action:** Update SPEC-004 to choose (1) or (2). Prefer (1) — simpler, no UX for option (2) yet.

#### F-UPLOAD-04: Read-modify-write race on `brand.json`
**Severity:** MEDIUM
**OWASP:** A04
**STRIDE:** T-008
**Specs affected:** SPEC-001, SPEC-004
**Finding:** Two concurrent `POST /logos` requests both read `brand.json`, modify different keys, and the second write wins — losing the first's changes. Same for a concurrent `PUT /api/brands/:slug` + `POST /logos`.
**Requirement:** Serialize writes per-slug. Simplest: an in-process `AsyncLock` or `Map<slug, Promise>` that all writes must acquire. For multi-process deploys, use a lock file under `brands/<slug>/.write-lock` with `fs.open` O_EXCL.
**Action:** Add a "Per-brand write lock" paragraph to SPEC-001's `brandWriter.ts` section and to SPEC-004's POST/DELETE handlers.

#### F-AUTH-02: CORS `credentials:true` + shared-key model
**Severity:** MEDIUM
**OWASP:** A01
**STRIDE:** T-011
**Specs affected:** `src/api/server.ts` (existing)
**Finding:** `cors({ origin: ..., credentials: true })` + API key sent via `X-Api-Key` header is safe (custom headers trigger CORS preflight), but dev mode sets `origin: true` which reflects the Origin header — potentially allowing any origin to read responses if credentials are not strictly needed.
**Requirement:** In dev, explicitly set origin to `http://localhost:8095` (and any other known dev origins). Do not reflect arbitrary origins.
**Action:** Minor fix in `server.ts`. Not in expansion specs but covered under REQ-066 reinforcement.

#### F-PLAY-02: Sandboxed iframe can still make network requests
**Severity:** MEDIUM
**OWASP:** A10 / A04
**STRIDE:** T-020
**Specs affected:** SPEC-008
**Finding:** `sandbox="allow-scripts"` without `allow-same-origin` isolates from the parent document but does NOT prevent outbound `fetch`/XHR/WebSocket/`<img src>` from inside the iframe. An attacker who can get an admin to paste malicious JSX into the playground could exfiltrate data from localhost addresses, scan the internal network, or send data to attacker-controlled origins.
**Requirement:** Add a per-iframe CSP via `<meta http-equiv="Content-Security-Policy">` in the `srcdoc`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:; connect-src 'none'">
```
This blocks all `fetch`/XHR while allowing the Babel standalone + React CDN loads and inline rendering.
**Action:** Update SPEC-008 playground `srcdoc` template to include the meta CSP.

#### F-FLAG-01: `DISABLE_PORTAL` does not disable public API
**Severity:** MEDIUM
**OWASP:** A01
**STRIDE:** T-028
**Specs affected:** SPEC-014
**Finding:** `DISABLE_PORTAL=1` returns 404 from `/portal/*` on Next.js, but `GET /api/brands/:slug/identity` and `/api/brands/:slug/guidelines` remain public on Express. An attacker who knows the API port can still scrape all brand data.
**Requirement:** Either:
1. `DISABLE_PORTAL=1` also disables the portal-specific API routes (`/identity`, `/logos`, `/typography`, `/guidelines`) on Express, OR
2. Document explicitly that the flag disables the public Next.js route only, and the API remains public by design.
**Action:** Add a decision note to SPEC-014. Prefer (1) — the flag name implies portal disablement, not "Next.js portal only".

#### F-PORTAL-03: Default `robots: index,follow` is insecure-by-default
**Severity:** MEDIUM
**OWASP:** A05
**STRIDE:** T-029
**Specs affected:** SPEC-006
**Finding:** SPEC-006 sets default `robots: index,follow` because the PRD says portals are "shareable public". But on a staging/dev instance, this causes Google to index brand pages that may contain unreleased brand work. The secure default is `noindex,nofollow` with opt-in to indexing.
**Requirement:** Reverse the default. Read `PORTAL_INDEX` (or `PORTAL_ALLOW_INDEX`) env var; when set to `1`, emit `index,follow`. When unset, emit `noindex,nofollow`. Update PRD/BRD accordingly if the intent is truly public-by-default; otherwise the secure default stands.
**Action:** Discussion in SPEC-006. If the product team insists on public-by-default, document the decision and note that staging deployments MUST set `PORTAL_NOINDEX=1`.

---

### LOW / INFORMATIONAL

#### F-PORTAL-01: Anonymous portal slug enumeration
**Severity:** LOW
**OWASP:** A01
**STRIDE:** T-001
**Finding:** `GET /portal/:slug/*` does not rate-limit per-IP enumeration of slugs. An attacker can crawl `/portal/aaa`, `/portal/aab`, ... to discover brand names. Since the brand list is probably small and public-facing is the intent, this is low-risk. Still, a generic `GET /api/brands` (which lists all slugs) is higher-leverage for an attacker.
**Action:** Confirm `GET /api/brands` (list) is on the public-portal code path. If it returns all brands to anonymous callers, acceptable per design. Document explicitly.

#### F-PORTAL-02: Per-IP read rate limit may be insufficient for public portal
**Severity:** LOW
**OWASP:** A04
**STRIDE:** T-002
**Finding:** `readLimiter` is 1000/15min per IP. For public portal behind a CDN/load-balancer without proper `X-Forwarded-For` trust, all traffic appears from one IP and 1000 req/15min is trivially exceeded by a single user browsing.
**Action:** Document in SPEC-014: if deploying behind a reverse proxy, set `app.set('trust proxy', ...)` and verify rate-limit keys on the real client IP.

#### F-ICON-01: Verify sanitization on ingestion
**Severity:** LOW
**OWASP:** A08
**STRIDE:** T-015
**Finding:** SPEC-003 says `scanner script will also pre-validate` but doesn't specify the validator. Material Symbols SVGs are trusted, but supply-chain compromise of google/material-design-icons is not zero-probability.
**Action:** `scripts/sync-icons.ts` MUST pipe each downloaded SVG through the same sanitizer as `sanitize-svg.ts`. If any SVG contains `<script>` or `on*=`, abort the sync with a warning (do not write the file).

#### F-ICON-02: No SHA-256 verification on icon sync
**Severity:** LOW
**OWASP:** A08
**STRIDE:** T-016
**Finding:** Icon sync downloads SVGs from raw.githubusercontent.com without verifying against a known-good manifest of SHA-256s. If the repo is compromised, the sync happily downloads malicious content.
**Action:** (Aspirational) publish a `icons.sha256.lock` file alongside `metadata.json`. On sync, compare downloaded-file SHA-256 against the lock; unknown hashes are written but flagged, existing-but-different hashes abort. Low priority given the upstream repo's profile.

#### F-AUDIT-01: No user attribution in audit log
**Severity:** LOW
**OWASP:** A09
**STRIDE:** T-022
**Finding:** All writes authenticated by the single shared API key. Audit log says `user: 'api-key'`. No way to attribute an action to a specific admin.
**Action:** Accept for single-operator deployments. If multi-admin is in scope, add per-admin API keys with labels (map in config file) — out of scope for this expansion.

#### F-AUDIT-02: Log injection via user-controlled slug/label
**Severity:** LOW
**OWASP:** A09
**STRIDE:** T-023
**Finding:** `console.log('[audit] ... POST /api/brands/evil\nFAKE AUDIT from ip')` injects arbitrary content into stdout logs.
**Action:** Pass slugs/labels through a CRLF strip (`.replace(/[\r\n]/g, ' ')`) before logging. Add to `auditLogger.ts`.

#### F-DOCKER-01: Non-root user enforcement not verified
**Severity:** INFO
**OWASP:** A05
**Finding:** SPEC-014 references `USER node` / UID 1000 but doesn't include a Dockerfile review step.
**Action:** SPEC-014 QA step: grep `Dockerfile` for `USER`; confirm non-root. If missing, add `USER node` before `CMD`.

#### F-MCP-01: SVG content flows to LLM
**Severity:** INFO
**Finding:** `get_icon` MCP tool returns SVG content as text. If Claude Code renders this content (it doesn't directly, but writes it to a file the user later opens), the stored-XSS risk is transferred.
**Action:** Informational. Document that SVG returned from MCP is trusted-by-ingestion (SPEC-003 validates on sync). If user-uploaded brand SVGs are ever exposed via MCP in a future spec, they must flow through the sanitizer first.

---

## 5. Spec-by-Spec Recommendations

### SPEC-001 (Brand Data Model & Migration)
- Add F-UPLOAD-04: per-slug write lock pattern to `brandWriter.ts`.
- Path-traversal guard for `slug` in migration script: use `path.resolve` + `startsWith` assertion.
- Migration `--delete-flat` must be opt-in (already is). Document backup recommendation.

### SPEC-002 (Guidelines Parser & API)
- **MUST** apply F-GUIDE-01: post-render sanitize-html pipeline with documented allowlist.
- Body size cap 100 KB is good; verify `textBody` middleware rejects >100KB with 413.
- `?raw=1` endpoint must have `Cache-Control: no-store` (already specified) — good.

### SPEC-003 (Icon Ingestion & API)
- Apply F-ICON-01: sync script MUST run sanitizer on each downloaded SVG.
- Rate-limit `GET /api/icons` — 7,500-item pages could be abused; current `limit=0` sentinel returns ~1.5MB body — consider caching.
- Cache headers for SVG responses (`Cache-Control: public, max-age=86400, immutable`) — good.

### SPEC-004 (Brand Identity & Logo API)
- **MUST** apply F-UPLOAD-01: comprehensive SVG sanitizer checklist.
- **MUST** apply F-UPLOAD-02: XXE prevention test.
- **MUST** apply F-UPLOAD-03: content-addressable filenames.
- **MUST** apply F-STATIC-02: sanitize-on-read, not regex scan.
- Per-request body size check independent of file size: reject multipart with >6MB total body.
- `multer` configuration MUST use `memoryStorage()` with strict `limits.fileSize` and `limits.files:1`.
- Extension allowlist on `GET /brand-assets/:slug/:file` is good — confirm `.svgz` (compressed SVG) is NOT in the list.

### SPEC-005 (Component Registry & API)
- `GET /api/components/:name/preview` returns HTML — CSP on that response must disable third-party origins. Add a response-level `Content-Security-Policy: default-src 'self'; script-src 'self'` header.
- Validate `:name` with a regex to block path traversal and XSS via name param.

### SPEC-006 (Portal Pages & Layout)
- Apply F-PORTAL-03: reverse robots default to secure-by-default.
- Confirm `middleware.ts` CSP does not regress when new routes added.
- Breadcrumbs and portal nav must escape brand name (use React — automatic).

### SPEC-007 (Brand Admin Editor)
- Apply F-AUTH-01 risk documentation: API key in localStorage is XSS-exfiltrable.
- MonacoEditor component loads from jsdelivr — confirm integrity check if possible (subresource integrity not natively supported by Monaco loader but document).
- Logo preview rendering: `<img src={url}>` — confirm `url` comes from API, not from unsanitized user input.

### SPEC-008 (Component Spec Browser)
- **Strong approval** of client-side playground decision.
- Apply F-PLAY-02: meta CSP inside srcdoc.
- Regression test: `POST /api/components/:name/preview` MUST 404/405 (attempt to add it must break a test) — already in acceptance tests. Good.
- `@babel/standalone` is ~3MB transpiled — use `next/dynamic` with `ssr:false` on the detail page (already specified).

### SPEC-009 (Icon Library Browser)
- Client-side canvas PNG rendering is good (avoids server-side image processor CVE surface).
- Virtualization over 7,500 items is fine; no DoS risk because data is preloaded once.
- "Copy React JSX" must emit escaped SVG content — React's JSX handling auto-escapes, but explicit test.

### SPEC-010 (lib/api.ts Client Functions)
- `buildAuthHeaders` reads from localStorage in browser, env in node — good pattern.
- `ApiError` class redacts API key before logging — verify (current spec has a note, not enforced).
- Add regression test: no `runComponentPreview` export exists.

### SPEC-011 (Sidebar Navigation)
- No security-specific findings; navigation is client-side only.

### SPEC-012 (MCP Server Expansion)
- `zod` regex on tool args is good (defense against path traversal).
- Confirm MCP server process does not have write permissions (reads only) — OS-level enforcement or code review.

### SPEC-013 (Test Suite)
- **MUST** include security regression tests for every finding above:
  - SVG XSS payloads (script, event handlers, javascript: URLs, XXE, foreignObject)
  - Markdown XSS (javascript: anchors, data: images, script blocks)
  - Path traversal (encoded and unencoded)
  - Filename collision behavior
  - Playground no-network-exfiltration test
  - API key not logged on error

### SPEC-014 (Docker & Feature Flags)
- Apply F-CSP-01: remove `unsafe-inline` scripts in production.
- Apply F-FLAG-01: `DISABLE_PORTAL` must also gate public API, or rename flag.
- Apply F-DOCKER-01: Dockerfile USER directive verification.
- Apply F-SUPPLY-01: add `npm audit` + SBOM steps.

---

## 6. BRD Requirements — Gaps

The BRD-tracker has 82 requirements. The following **new security requirements** should be added (the specs reference REQ-066, REQ-073, REQ-077, REQ-079, REQ-081, REQ-082 for security, but these gaps are not tracked):

### Proposed New Requirements

| ID | Title | Category | Source | Maps to Finding |
|----|-------|----------|--------|-----------------|
| **REQ-083** | SVG sanitizer strips all OWASP XSS vectors including foreignObject, use external href, xlink:href javascript:, DOCTYPE/ENTITY (XXE), style blocks | security | F-UPLOAD-01, F-UPLOAD-02 | HIGH |
| **REQ-084** | Guidelines markdown→HTML output post-processed through sanitize-html allowlist; `javascript:` and `data:` (non-image) anchors blocked | security | F-GUIDE-01 | HIGH |
| **REQ-085** | Static brand-asset serving sanitizes SVG on-read (re-runs sanitizer), not regex scan | security | F-STATIC-02 | HIGH |
| **REQ-086** | Production CSP removes `'unsafe-inline'` from `script-src`; nonce-based CSP or documented blocker | security | F-CSP-01 | HIGH |
| **REQ-087** | New dependencies version-pinned; `npm audit --audit-level=high` CI gate; SBOM generated via syft | supply-chain | F-SUPPLY-01 | HIGH |
| **REQ-088** | Admin UI API-key-in-localStorage threat documented; explicit admin trust boundary stated | security | F-AUTH-01 | HIGH |
| **REQ-089** | Logo upload uses content-addressable filenames (SHA-256 suffix) to prevent silent overwrite | security | F-UPLOAD-03 | MEDIUM |
| **REQ-090** | Per-slug write lock on `brand.json` read-modify-write sequences | security | F-UPLOAD-04 | MEDIUM |
| **REQ-091** | Playground srcdoc iframe includes meta CSP blocking `connect-src` network exfiltration | security | F-PLAY-02 | MEDIUM |
| **REQ-092** | `DISABLE_PORTAL` flag gates portal-specific API routes, not just Next.js pages | security | F-FLAG-01 | MEDIUM |
| **REQ-093** | Portal robots default is `noindex,nofollow`; `PORTAL_INDEX=1` opts into indexing | security | F-PORTAL-03 | MEDIUM |
| **REQ-094** | Icon sync script runs sanitizer on each downloaded SVG; aborts on malicious content | security | F-ICON-01 | LOW |
| **REQ-095** | Audit log strips CRLF from user-controlled fields before stdout write | security | F-AUDIT-02 | LOW |

---

## 7. Security Requirements for Implementation Gate (Gate 3 — Build)

Before any code is merged, verify:

- [ ] `npm audit --audit-level=high` passes
- [ ] SBOM generated (`sbom.cdx.json` in repo root)
- [ ] Gitleaks scan passes (no secrets)
- [ ] Semgrep SAST scan passes on new code paths (config: `p/owasp-top-ten`)
- [ ] All HIGH findings (F-UPLOAD-01, F-GUIDE-01, F-STATIC-02, F-AUTH-01, F-CSP-01, F-SUPPLY-01) have explicit acceptance tests
- [ ] Unit tests include OWASP SVG XSS cheatsheet payloads
- [ ] Unit tests include markdown XSS payloads
- [ ] Integration test: `POST /api/components/:name/preview` returns 404/405
- [ ] Integration test: playground `srcdoc` iframe cannot reach `http://localhost:8096/api/*`
- [ ] Integration test: path traversal attempts on all static routes return 400
- [ ] E2E (Playwright): zero CSP violations on portal, admin, and component detail pages

---

## 8. Follow-up TODO Files to Create

The following TODO files should be created in `docs/TODO/`:

1. `SHARED-supply-chain-hardening.md` — F-SUPPLY-01 actions (npm audit gate, SBOM, dep pinning)
2. `SHARED-security-regression-tests.md` — F-UPLOAD-01/02, F-GUIDE-01, F-STATIC-02 payload library and test plan
3. `SHARED-csp-hardening.md` — F-CSP-01 nonce-based CSP migration plan

These are informational handoffs for Phase 4 (Implementation). The conductor should spawn them as sibling TODOs.

---

## 9. Approval Conditions

**The expansion is APPROVED for Phase 4 implementation PROVIDED**:

1. **All 6 HIGH findings are addressed in the respective spec updates** before implementation begins. Edit SPEC-002, SPEC-004, SPEC-008, SPEC-014, and `middleware.ts` per the detailed recommendations above.

2. **All 7 MEDIUM findings are tracked as new BRD requirements (REQ-083 through REQ-095 above)** and incorporated into the acceptance criteria of their parent specs.

3. **SPEC-013 (Test Suite) is extended** with the security regression test list from Section 7 above.

4. **A supply-chain hardening TODO** is created and assigned to Phase 5 (QA).

5. **Phase 5 QA includes a security scan pass** using the testing-security-stack (Semgrep, Trivy, Gitleaks, OWASP ZAP against the running portal).

6. **Phase 6 Release gate** requires the CISO to re-verify that all implemented code matches the approved spec language — this is Gate 3 + Gate 5.

### Verdict Summary

```
╔════════════════════════════════════════════════════════════════╗
║              CISO SECURITY VERDICT (ARCHITECTURE)              ║
╠════════════════════════════════════════════════════════════════╣
║ Review Date: 2026-04-17                                        ║
║ Scope: SPEC-001..SPEC-014, middleware.ts, server.ts            ║
║ Lines reviewed: ~4,200 (spec text) + ~2,100 (existing code)    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ OVERALL VERDICT: APPROVED WITH CONDITIONS                     ║
║                                                                ║
╠═══════════════════ SECURITY FINDINGS ══════════════════════════╣
║ Critical: 0                                                    ║
║ High:     6  ← MUST resolve before implementation              ║
║ Medium:   7  ← SHOULD resolve (tracked as new REQs)            ║
║ Low:      4                                                    ║
║ Info:     3                                                    ║
╠═══════════════════ COMPLIANCE STATUS ══════════════════════════╣
║ OWASP Top 10 2025:  PARTIAL (A05, A06 gaps)                    ║
║ OWASP API Top 10:   PASS                                       ║
║ NIST SSDF:          PARTIAL (supply chain gap)                 ║
║ Supply Chain:       PARTIAL (no SBOM, unpinned deps)           ║
║ Container Security: PARTIAL (USER directive unverified)        ║
╠═══════════════════ BLOCKING ISSUES ════════════════════════════╣
║ None — all HIGH findings have clear remediation paths          ║
║ and do not require architectural changes.                      ║
╠═══════════════════ REQUIRED ACTIONS ═══════════════════════════╣
║ 1. Update SPEC-002 per F-GUIDE-01                              ║
║ 2. Update SPEC-004 per F-UPLOAD-01/02/03/04, F-STATIC-02       ║
║ 3. Update SPEC-008 per F-PLAY-02                               ║
║ 4. Update SPEC-014 per F-CSP-01, F-FLAG-01, F-DOCKER-01,       ║
║    F-SUPPLY-01                                                 ║
║ 5. Add REQ-083..REQ-095 to BRD-tracker.json                    ║
║ 6. Create 3 supporting TODOs (supply chain, regression tests,  ║
║    CSP hardening)                                              ║
╚════════════════════════════════════════════════════════════════╝
```

---

**End of CISO Architecture Security Review.**
