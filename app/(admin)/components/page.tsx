"use client";

/**
 * Component spec index (SPEC-008 REQ-021).
 *
 * Registry-driven browseable index of every component in the library, with
 * substring search (debounced 200 ms) and tier-exact filter. Each card links
 * to `/components/:name` for the full spec.
 *
 * Replaces the legacy `/components-library` page, which now 301-redirects
 * here via `next.config.ts` (REQ-067).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getComponents } from "@/lib/api";
import type { ComponentSpec } from "@/lib/api";

type TierFilter = "all" | "ui" | "primitives" | "features" | "effects";

const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All tiers" },
  { value: "ui", label: "ui" },
  { value: "primitives", label: "primitives" },
  { value: "features", label: "features" },
  { value: "effects", label: "effects" },
];

/** Map tier → Badge variant. Neutral / informational palette. */
function tierBadgeClass(tier: ComponentSpec["tier"]): string {
  switch (tier) {
    case "ui":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    case "primitives":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "features":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "effects":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200";
  }
}

export default function ComponentsIndexPage() {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");

  const [items, setItems] = useState<ComponentSpec[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search input by 200 ms so we're not firing a request on
  // every keystroke.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [rawQuery]);

  // Fetch whenever the effective query or tier changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: { q?: string; tier?: string } = {};
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
    if (tier !== "all") params.tier = tier;

    getComponents(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, tier]);

  const showEmpty = !loading && !error && items.length === 0;
  const showGrid = !loading && !error && items.length > 0;

  const countLabel = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return "Error";
    if (total === 0) return "0 components";
    return `${items.length} of ${total} component${total === 1 ? "" : "s"}`;
  }, [loading, error, total, items.length]);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-2">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/" }, { label: "Components" }]}
        />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Components</h1>
      <p className="text-muted-foreground mb-6">
        Registry-driven catalog of every component in the library. Click a card
        to view its full spec, props, variants, and interactive playground.
      </p>

      {/* Controls row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search components by name or description…"
            className="pl-10"
            aria-label="Search components"
          />
        </div>
        <Select value={tier} onValueChange={(v) => setTier(v as TierFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by tier">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground sm:min-w-[140px] sm:text-right">
          {countLabel}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div
          role="status"
          aria-label="Loading components"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Failed to load components.</p>
          <p className="mt-1 text-destructive/80">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            No components match those filters.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try clearing the search or switching tier to “All tiers”.
          </p>
        </div>
      )}

      {/* Card grid */}
      {showGrid && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link
              key={c.name}
              href={`/components/${encodeURIComponent(c.name)}`}
              className="group rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground group-hover:text-primary">
                  {c.name}
                </h3>
                <Badge
                  variant="secondary"
                  className={`shrink-0 border-0 ${tierBadgeClass(c.tier)}`}
                >
                  {c.tier}
                </Badge>
              </div>
              <p className="line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
                {c.description || <em className="opacity-60">No description</em>}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <code className="truncate text-muted-foreground/70">{c.path}</code>
                <span className="text-primary/80 group-hover:text-primary">
                  View spec →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
