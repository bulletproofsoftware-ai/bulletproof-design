import Link from "next/link";

/**
 * PortalBreadcrumbs — public-facing breadcrumb trail for portal pages.
 *
 * Distinct from `components/features/Breadcrumbs`, which is an admin-only
 * client component styled with sidebar tokens. Portal breadcrumbs are a
 * pure server component rendered on a white background with the mockup's
 * typography (small grey text, blue links, `›` separator).
 *
 * Items: `[{ label, href? }]`. The last item is the current page — its
 * `href` is ignored so it renders as plain text even if provided.
 */

export interface PortalBreadcrumbItem {
  label: string;
  href?: string;
}

export interface PortalBreadcrumbsProps {
  items: PortalBreadcrumbItem[];
}

export function PortalBreadcrumbs({ items }: PortalBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-2 text-[13px] text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-x-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/60">
                  ›
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-primary hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-foreground/80"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
