"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PortalSidebar — brand-scoped navigation for `/portal/[slug]/*` (SPEC-006).
 *
 * Public-facing left rail. Visually integrated with the admin shell: applies
 * the `.sidebar` class (dark `#111827` background, `#e2e8f0` foreground from
 * app/globals.css) and the same slate/white-alpha utility palette the admin
 * Sidebar uses. The "Design Library" wordmark at the top doubles as the
 * link home, replacing the standalone top nav this page used to render.
 */

export interface PortalSidebarLink {
  href: string;
  label: string;
}

export interface PortalSidebarProps {
  /** Brand slug, used to build section hrefs. */
  slug: string;
  /** Display name shown at the top of the sidebar. */
  brandName: string;
  /**
   * Optional one-letter mark rendered inside a colored square next to the
   * brand name. Defaults to the first letter of `brandName`.
   */
  brandInitial?: string;
  /**
   * Background color of the brand initial square. Defaults to the
   * `--ds-brand-primary` design token.
   */
  brandInitialColor?: string;
  /**
   * Additional link groups below the Visual Identity section
   * (e.g. asset downloads, PDFs). Optional.
   */
  extraSections?: Array<{ title: string; items: PortalSidebarLink[] }>;
}

export function PortalSidebar({
  slug,
  brandName,
  brandInitial,
  brandInitialColor,
  extraSections,
}: PortalSidebarProps) {
  const pathname = usePathname();

  const visualIdentityLinks: PortalSidebarLink[] = [
    { href: `/portal/${slug}`, label: "Overview" },
    { href: `/portal/${slug}/colors`, label: "Color Palette" },
    { href: `/portal/${slug}/typography`, label: "Typography" },
    { href: `/portal/${slug}/logo-usage`, label: "Logo Usage" },
    { href: `/portal/${slug}/imagery`, label: "Imagery" },
  ];

  const initial = (brandInitial ?? brandName.charAt(0) ?? "?").toUpperCase();

  return (
    <aside
      aria-label={`${brandName} brand portal navigation`}
      className="sidebar flex w-[280px] shrink-0 flex-col border-r border-white/5"
    >
      {/* Design Library wordmark — matches admin sidebar header. */}
      <Link
        href="/"
        className="flex h-14 items-center gap-2.5 px-5 transition-opacity hover:opacity-80"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
          <LayoutTemplate className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-bold tracking-tight text-white">
          Design Library
        </span>
      </Link>

      {/* Brand header */}
      <div className="mx-3 mb-4 rounded-md border border-white/5 bg-white/5 px-3 py-3">
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Brand
        </h3>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <span
            className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white"
            style={{
              backgroundColor:
                brandInitialColor ?? "var(--color-primary)",
            }}
            aria-hidden="true"
          >
            {initial}
          </span>
          <span>{brandName}</span>
        </h2>
      </div>

      {/* Visual identity */}
      <PortalSidebarSection
        title="Visual Identity"
        items={visualIdentityLinks}
        pathname={pathname}
      />

      {/* Extra sections (e.g., asset downloads, PDFs). */}
      {extraSections?.map((section) => (
        <div key={section.title} className="mt-4">
          <PortalSidebarSection
            title={section.title}
            items={section.items}
            pathname={pathname}
          />
        </div>
      ))}
    </aside>
  );
}

function PortalSidebarSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: PortalSidebarLink[];
  pathname: string | null;
}) {
  return (
    <div className="px-3">
      <div className="mb-1 px-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h4>
      </div>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = isLinkActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-all",
                active
                  ? "bg-[#374151] text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href;
}
