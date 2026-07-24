"use client";

/**
 * Icon Library Browser (SPEC-009 / REQ-027 / REQ-065).
 *
 * Single client-rendered page that:
 *   1. Preloads the full Material Symbols catalogue once via
 *      `GET /api/icons?limit=0` (SPEC-003 sentinel for first-party UIs).
 *   2. Filters/searches entirely in memory for instant updates.
 *   3. Renders a virtualized grid (@tanstack/react-virtual) so ~7,500
 *      entries scroll without jank.
 *   4. Opens the detail sheet (REQ-028) with copy + download actions,
 *      including client-side PNG rendering (REQ-068).
 *
 * No MaterialSymbol component reference — inline SVG snippets only.
 */

import * as React from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import {
  getIconCategories,
  getIcons,
  type IconMetadata,
  type IconStyle,
  type IconsCategory,
} from "@/lib/api";
import { matchIcon } from "./icon-utils";
import { VirtualIconGrid } from "./VirtualIconGrid";
import { IconDetailSheet } from "./IconDetailSheet";

const STYLE_OPTIONS: Array<{ value: "all" | IconStyle; label: string }> = [
  { value: "all", label: "All styles" },
  { value: "outlined", label: "Outlined" },
  { value: "rounded", label: "Rounded" },
  { value: "sharp", label: "Sharp" },
];

const SIZE_OPTIONS: Array<24 | 36 | 48> = [24, 36, 48];

export default function IconsPage() {
  const [icons, setIcons] = React.useState<IconMetadata[]>([]);
  const [categories, setCategories] = React.useState<IconsCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [styleFilter, setStyleFilter] = React.useState<"all" | IconStyle>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [previewSize, setPreviewSize] = React.useState<24 | 36 | 48>(36);

  // Detail sheet
  const [selected, setSelected] = React.useState<IconMetadata | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Debounce the search input so typing doesn't trigger re-filtering on
  // every keystroke (the filter is cheap, but the virtualizer recomputes
  // layout — debouncing feels snappier).
  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 150);
    return () => window.clearTimeout(handle);
  }, [search]);

  // Initial load — full catalogue + categories in parallel.
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [iconsRes, catsRes] = await Promise.all([
          getIcons({ limit: 0 }),
          getIconCategories(),
        ]);
        if (cancelled) return;
        setIcons(iconsRes.items);
        setCategories(catsRes);
      } catch (err) {
        if (cancelled) return;
        setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // In-memory filter: style → category → search.
  const filteredIcons = React.useMemo(() => {
    return icons.filter((icon) => {
      if (styleFilter !== "all" && !icon.styles.includes(styleFilter)) {
        return false;
      }
      if (category !== "all" && icon.category !== category) return false;
      if (!matchIcon(icon, debouncedSearch.trim())) return false;
      return true;
    });
  }, [icons, styleFilter, category, debouncedSearch]);

  const effectiveStyle: IconStyle =
    styleFilter === "all" ? "outlined" : styleFilter;

  function handleSelect(icon: IconMetadata) {
    setSelected(icon);
    setSheetOpen(true);
  }

  return (
    <div className="flex h-screen flex-col p-6">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/" }, { label: "Icons" }]}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Icons</h1>
          <Badge variant="secondary" data-testid="icons-total">
            {loading
              ? "Loading…"
              : `${filteredIcons.length.toLocaleString()} of ${icons.length.toLocaleString()}`}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Material Symbols icon library — outlined, rounded, and sharp variants.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search name, alias, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="icons-search"
          />
        </div>

        {/* Style filter — rendered as button chips for one-click toggling */}
        <div
          role="group"
          aria-label="Style filter"
          className="flex rounded-md border p-0.5"
          data-testid="icons-style-filter"
        >
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStyleFilter(opt.value)}
              className={
                "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                (styleFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              data-testid={`style-${opt.value}`}
              aria-pressed={styleFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="min-w-[180px]" data-testid="icons-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.category} value={c.category}>
                {c.category} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Preview size toggle */}
        <div
          role="group"
          aria-label="Preview size"
          className="flex rounded-md border p-0.5"
          data-testid="icons-size"
        >
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPreviewSize(size)}
              className={
                "rounded px-2 py-1 text-xs font-medium transition-colors " +
                (previewSize === size
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              data-testid={`size-${size}`}
              aria-pressed={previewSize === size}
            >
              {size}px
            </button>
          ))}
        </div>

        {(search || styleFilter !== "all" || category !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setStyleFilter("all");
              setCategory("all");
            }}
            data-testid="icons-reset"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 rounded-md border bg-card">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading icon catalogue…
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
            Failed to load icons: {loadError}
          </div>
        ) : (
          <VirtualIconGrid
            icons={filteredIcons}
            previewSize={previewSize}
            style={effectiveStyle}
            onSelect={handleSelect}
          />
        )}
      </div>

      <IconDetailSheet
        icon={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        previewSize={previewSize}
      />
    </div>
  );
}
