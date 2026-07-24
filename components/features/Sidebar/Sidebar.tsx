"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LayoutTemplate,
  BookOpen,
  Palette,
  Image,
  Import,
  ChevronDown,
  ChevronRight,
  Search,
  Type,
  Paintbrush,
  Layers,
  Wand2,
  Rocket,
  FileCode,
  Settings,
  Pencil,
  Component,
  Grid3x3,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategories, getBrands } from "@/lib/api";
import type { Category, BrandSummary } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
  indent?: boolean;
  badge?: string | number;
  external?: boolean;
}

interface NavSection {
  title: string;
  key: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    templates: true,
    components: true,
    // SPEC-011 REQ-061 — foundations houses /icons, brands houses the
    // portal list; default them open so those links are reachable
    // without an extra click.
    foundations: true,
    brands: true,
    tools: false,
  });

  // Fetch categories on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const cats = await getCategories();
        if (!cancelled) setCategories(cats);
      } catch {
        if (!cancelled) setError("Unable to load categories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // SPEC-011 REQ-061 — Fetch brand list for Brand portals subsection.
  // Failure to load brands is non-fatal: the rest of the sidebar still
  // works, and the portal entries simply don't appear. We intentionally
  // don't surface an error state here — missing portal links are
  // recoverable by direct URL entry and the main categories error path
  // already handles API outages.
  useEffect(() => {
    let cancelled = false;
    async function loadBrands() {
      try {
        const list = await getBrands();
        // Guard against malformed API responses — the brand portal list
        // is non-critical, so an unexpected shape should gracefully
        // degrade to "no portals" rather than crashing the sidebar.
        if (!cancelled) setBrands(Array.isArray(list) ? list : []);
      } catch {
        /* swallow — see comment above */
      }
    }
    loadBrands();
    return () => { cancelled = true; };
  }, []);

  // Separate components from templates
  const componentCategories = categories.filter((c) => c.name === "components");
  const templateCategories = categories.filter((c) => c.name !== "components");
  const totalTemplates = templateCategories.reduce((sum, c) => sum + c.count, 0);
  const totalComponents = componentCategories.reduce((sum, c) => sum + c.count, 0);

  // Build sections
  const sections: NavSection[] = useMemo(() => {
    const templateItems: NavItem[] = [
      {
        href: "/templates",
        label: `All Templates`,
        icon: Layers,
        badge: totalTemplates || undefined,
      },
      ...templateCategories.map((cat) => ({
        href: `/templates?category=${encodeURIComponent(cat.name)}`,
        label: cat.name.replace(/-/g, " "),
        indent: true,
        badge: cat.count,
      })),
    ];

    const componentItems: NavItem[] = [
      {
        // SPEC-008 REQ-067 — legacy `/components-library` 301-redirects to
        // `/components`, but we link directly to the canonical URL so the
        // active-state highlight works without an extra navigation hop.
        href: "/components",
        label: "All Components",
        icon: Component,
        badge: totalComponents || undefined,
      },
    ];

    return [
      {
        title: "Getting Started",
        key: "getting-started",
        items: [
          { href: "/", label: "Overview", icon: BookOpen },
          { href: "/guide", label: "Quick Start", icon: Rocket },
          { href: "/api-docs", label: "API Reference", icon: FileCode },
        ],
      },
      {
        title: "Foundations",
        key: "foundations",
        items: [
          { href: "/foundations/colors", label: "Colors & Tokens", icon: Paintbrush },
          { href: "/foundations/typography", label: "Typography", icon: Type },
          // SPEC-011 REQ-061 — dedicated /icons link for the icon library
          // (SPEC-009). Kept separate from the "Icons & Assets" asset-manager
          // entry below to avoid conflating the two different surfaces.
          { href: "/icons", label: "Icons", icon: Grid3x3 },
          { href: "/assets", label: "Icons & Assets", icon: Image },
        ],
      },
      {
        title: "Templates",
        key: "templates",
        items: templateItems,
      },
      {
        title: "Components",
        key: "components",
        items: componentItems,
      },
      {
        title: "Brands",
        key: "brands",
        items: [
          { href: "/brands", label: "Overview", icon: Palette },
          { href: "/brands/configurator", label: "Configurator", icon: Wand2 },
          // SPEC-011 REQ-061 — dynamic portal links, one per brand.
          // Marked external because /portal/* is a public-facing surface
          // outside the admin route group.
          ...brands.map<NavItem>((b) => ({
            href: `/portal/${b.slug}`,
            label: b.name,
            icon: ExternalLink,
            indent: true,
            external: true,
          })),
        ],
      },
      {
        title: "Tools",
        key: "tools",
        items: [
          { href: "/import", label: "Import from URL", icon: Import },
          { href: "/templates/new", label: "Template Editor", icon: Pencil },
          { href: "/assets", label: "Asset Manager", icon: Image },
        ],
      },
    ];
  }, [templateCategories, componentCategories, totalTemplates, totalComponents, brands]);

  // Filter by search
  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, search]);

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    // For query-string links like /templates?category=foo
    if (href.includes("?")) {
      const [path, query] = href.split("?");
      return pathname === path && typeof window !== "undefined" && window.location.search.includes(query);
    }
    // SPEC-011 REQ-061 — match exact href or any nested child, but NOT
    // sibling routes that happen to share the prefix. Prevents
    // `/components` from highlighting on `/components-library`.
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="sidebar flex w-[260px] shrink-0 flex-col border-r border-white/5">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
          <LayoutTemplate className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-white">
          Design Library
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 border-white/10 bg-white/5 pl-8 text-xs text-slate-300 placeholder:text-slate-500 focus-visible:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Nav sections */}
      <ScrollArea className="flex-1">
        <nav className="px-3 pb-3">
          {filteredSections.map((section) => {
            const isExpanded = search.trim() ? true : expanded[section.key];

            return (
              <div key={section.key} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <span>{section.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>

                {/* Section items */}
                {isExpanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {section.key === "templates" && loading ? (
                      <>
                        <div className="h-7 animate-pulse rounded-md bg-white/5" />
                        <div className="h-7 animate-pulse rounded-md bg-white/5" />
                        <div className="h-7 animate-pulse rounded-md bg-white/5" />
                      </>
                    ) : section.key === "templates" && error ? (
                      <div className="px-2 py-1.5">
                        <p className="text-[12px] text-red-400">{error}</p>
                        <button
                          onClick={() => {
                            setError(null);
                            setLoading(true);
                            getCategories()
                              .then((cats) => setCategories(cats))
                              .catch(() => setError("Unable to load categories"))
                              .finally(() => setLoading(false));
                          }}
                          className="mt-1 text-[12px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      section.items.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href + item.label}
                            href={item.href}
                            data-active={active ? "true" : "false"}
                            data-external={item.external ? "true" : undefined}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-all",
                              item.indent ? "pl-8" : "pl-2",
                              active
                                ? "bg-[#374151] text-white"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            )}
                          >
                            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                            {!Icon && item.indent && (
                              <span className="mr-0.5 text-slate-600">&rsaquo;</span>
                            )}
                            <span className="truncate capitalize">{item.label}</span>
                            {active && (
                              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                            )}
                            {item.badge !== undefined && !active && (
                              <Badge
                                variant="secondary"
                                className="ml-auto h-5 min-w-[20px] justify-center bg-white/10 px-1.5 text-[10px] text-slate-400 border-0"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom status */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 px-2 text-xs text-slate-500">
          <Settings className="h-3.5 w-3.5" />
          <span>API: localhost:8096</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>
    </aside>
  );
}
