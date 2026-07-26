/**
 * In-memory component registry index.
 *
 * Loads `src/components/registry.json` at server startup and exposes
 * a typed query surface for the `/api/components` routes.
 *
 * SPEC-005 — REQ-037 (list + filter), REQ-038 (single), REQ-069 (new shape).
 *
 * File-watch semantics:
 *   - Production (`NODE_ENV=production`): index loaded once at startup.
 *     A restart is required to pick up registry changes.
 *   - Dev / test: on every `get`/`search` call we compare the current mtime
 *     against the loaded mtime; if changed, reload synchronously. This is
 *     cheap (one `fs.stat`) and avoids spawning a watcher that leaks handles
 *     during Jest runs.
 */

import { closeSync, fstatSync, openSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import type { ComponentSpec } from "../../../lib/types/api";

/** Default registry path — overridable for tests. */
const DEFAULT_REGISTRY_PATH = resolve(
  process.cwd(),
  "src",
  "components",
  "registry.json",
);

export interface ComponentIndex {
  /** Return every registered component (deterministic order). */
  all(): ComponentSpec[];
  /** Look up by name — case-insensitive. */
  get(name: string): ComponentSpec | undefined;
  /** Filter by optional `q` (substring across name/description/deps) and `tier`. */
  search(opts?: { q?: string; tier?: string }): ComponentSpec[];
  /** Force a reload from disk. */
  reload(): void;
}

interface IndexState {
  registryPath: string;
  items: ComponentSpec[];
  byName: Map<string, ComponentSpec>;
  mtimeMs: number;
}

/**
 * Create a component index backed by a registry.json file.
 *
 * If loading fails, the index is initialized empty — callers (routes) will
 * surface that as a 200 with `items: []`. We intentionally do not throw from
 * the factory so a malformed/missing registry does not crash the whole API
 * server; a warning is logged instead. This matches SPEC-005 "Backward
 * compatible for components without parseable props" intent.
 */
export function createComponentIndex(registryPath: string = DEFAULT_REGISTRY_PATH): ComponentIndex {
  const state: IndexState = {
    registryPath,
    items: [],
    byName: new Map(),
    mtimeMs: 0,
  };

  function loadSync(): void {
    try {
      // stat-then-read on a path is two lookups of a name that can be replaced in
      // between (CodeQL js/file-system-race). Open once and take both the stat and
      // the contents from that single descriptor, so they always describe the same
      // file.
      const fd = openSync(registryPath, "r");
      let stat: ReturnType<typeof fstatSync>;
      let raw: string;
      try {
        stat = fstatSync(fd);
        raw = readFileSync(fd, "utf8");
      } finally {
        closeSync(fd);
      }
      const parsed = JSON.parse(raw) as { components?: ComponentSpec[] };
      const items = Array.isArray(parsed.components) ? parsed.components : [];
      // Normalize: guarantee every entry is a plain object with a name/tier.
      // Entries that fail validation are dropped (not logged individually to
      // avoid spamming during noisy dev reloads).
      const filtered = items.filter(
        (c) =>
          c &&
          typeof c.name === "string" &&
          typeof c.tier === "string" &&
          ["ui", "primitives", "features", "effects"].includes(c.tier),
      );
      // Deterministic order: by tier index, then name.
      const tierOrder = ["ui", "primitives", "features", "effects"];
      filtered.sort((a, b) => {
        const ta = tierOrder.indexOf(a.tier);
        const tb = tierOrder.indexOf(b.tier);
        if (ta !== tb) return ta - tb;
        return a.name.localeCompare(b.name);
      });

      state.items = filtered;
      state.byName = new Map(
        filtered.map((c) => [c.name.toLowerCase(), c]),
      );
      state.mtimeMs = stat.mtimeMs;
    } catch (err) {
      // Keep any previously loaded data — better to serve stale than nothing.
      // If this is the first load, items stays empty.
      console.warn(
        `[componentIndex] Failed to load ${registryPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Reload from disk if the file has been modified since the last load. */
  function maybeReload(): void {
    // In production we never hot-reload; a restart is required.
    if (process.env.NODE_ENV === "production") return;
    try {
      const stat = statSync(registryPath);
      if (stat.mtimeMs !== state.mtimeMs) loadSync();
    } catch {
      // If stat fails and we already have items, keep them.
    }
  }

  // Initial load at construction time.
  loadSync();

  return {
    all() {
      maybeReload();
      return state.items;
    },
    get(name: string) {
      maybeReload();
      if (!name || typeof name !== "string") return undefined;
      return state.byName.get(name.toLowerCase());
    },
    search(opts?: { q?: string; tier?: string }): ComponentSpec[] {
      maybeReload();
      let result = state.items;

      const tier = opts?.tier?.trim();
      if (tier) {
        result = result.filter((c) => c.tier === tier);
      }

      const q = opts?.q?.trim().toLowerCase();
      if (q) {
        result = result.filter((c) => {
          if (c.name.toLowerCase().includes(q)) return true;
          if (c.description && c.description.toLowerCase().includes(q)) return true;
          if (c.dependencies?.some((d) => d.toLowerCase().includes(q))) return true;
          return false;
        });
      }
      return result;
    },
    reload() {
      loadSync();
    },
  };
}

/**
 * Default singleton — lazily instantiated on first access.
 * Route handlers import this rather than re-creating the index.
 */
let defaultIndex: ComponentIndex | undefined;
export function getDefaultComponentIndex(): ComponentIndex {
  if (!defaultIndex) defaultIndex = createComponentIndex();
  return defaultIndex;
}

/** Reset for tests. */
export function __resetDefaultComponentIndexForTests(): void {
  defaultIndex = undefined;
}
