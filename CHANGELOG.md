# Changelog

## 1.0.1 — 2026-07-24 (production-readiness remediation)

### Fixed
- README install command is now `npm ci --legacy-peer-deps` (plain
  `npm install` fails on the eslint@10 peer conflict; CI and the Dockerfile
  already used the flag).
- Restored `docker-compose.yml` (icons volume + feature-flag env vars) so the
  SPEC-014 infrastructure tests assert against a shipped file.
- generate-registry regressions: TSX optional-prop detection, destructured
  prop defaults, and guidelines enrichment from `registry-meta.yaml` are
  implemented; schema updated accordingly.
- Replaced the stripped `bulletproof-mark` test fixture with a shipped generic
  shield mark (`assets/brands/bulletproof/mark.svg`).
- Stale SPEC-014 CSP assertions updated to the refactored `apiOrigin`
  middleware variable.
- `npm test` generates design tokens first (`pretest`), so the suite passes
  from a clean clone.

### Changed
- The two live-server API test suites are gated behind `RUN_API_TESTS=1`
  (skipped by default) and documented in the README.
- `.env.example` rewritten: dead `API_PORT` dropped (code reads `PORT`),
  local-dev paths instead of container paths, and the documented
  `CORS_ORIGIN`, `TEMPLATES_DIR`, `ICONS_DIR`, `GITHUB_TOKEN`, `DISABLE_*`,
  `PORTAL_INDEX`, and `INTERNAL_API_URL` variables added.
- Script examples genericized (no operator-specific `~/Code` paths).
- `docs/2026-04-03-design-system-buildout.md` marked as an internal planning
  document.

### Added
- `SECURITY.md`, `CHANGELOG.md`.

## 1.0.0
- Initial public release.
