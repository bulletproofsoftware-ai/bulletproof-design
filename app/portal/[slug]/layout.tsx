import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalSidebar } from "@/components/features/PortalSidebar";
import { getBrandForPortal } from "@/lib/api";
import { extractPrimaryColor } from "@/lib/types/brand";

/**
 * Portal layout (SPEC-006, REQ-009, REQ-071, REQ-074, REQ-081).
 *
 * Public-facing shell for `/portal/[slug]/*`. Escapes the admin `(admin)`
 * route group so the admin sidebar never renders here. Fetches the brand
 * once at the layout level and reuses it for the per-page sidebar context
 * plus the layout-level OG/robots metadata.
 *
 * REQ-074 metadata:
 *   - Per-brand `<title>` and description.
 *   - OpenGraph tags for rich link previews.
 *   - Robots directive (REQ-093, CISO F-PORTAL-03): secure-by-default.
 *     Every portal page emits `noindex,nofollow` unless `PORTAL_INDEX=1`
 *     is explicitly set on the Next.js process. This prevents staging and
 *     tenant pre-release environments from being accidentally indexed by
 *     search engines. Production tenants that have approved public
 *     indexing must opt in via `PORTAL_INDEX=1`. Child pages may override
 *     the page title via their own `generateMetadata()` — this layout
 *     provides the baseline.
 *
 * REQ-081: portal pages render logo SVGs via `<img src>` only; no
 * `<iframe>`, no inline `<script>`. The existing middleware.ts CSP covers
 * this with `img-src 'self' data: http://localhost:8096 …`.
 * No CSP adjustments are required — see CSP audit note in commit message.
 */

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);

  if (!brand) {
    return {
      title: "Brand Portal — Not Found",
      robots: { index: false, follow: false },
    };
  }

  const title = `${brand.name} — Brand Portal`;
  const description =
    brand.description ?? `Visual identity guidelines for ${brand.name}.`;

  // REQ-093 — secure-by-default: only opt INTO indexing when PORTAL_INDEX=1
  // is explicitly set. Any other value (unset, "0", "true", etc.) emits
  // noindex,nofollow. Staging and dev MUST leave PORTAL_INDEX unset.
  const allowIndex = process.env.PORTAL_INDEX === "1";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Design Library",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: allowIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) notFound();

  const primaryColor = extractPrimaryColor(brand.colors);

  const extraSections = [
    {
      title: "Resources",
      items: [
        { href: `/portal/${slug}/downloads`, label: "Asset Downloads" },
        { href: `/portal/${slug}/guidelines`, label: "Brand Guidelines (PDF)" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <PortalSidebar
        slug={slug}
        brandName={brand.name}
        brandInitialColor={primaryColor}
        extraSections={extraSections}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden px-12 py-8">
        <div className="mx-auto max-w-[960px]">{children}</div>
      </main>
    </div>
  );
}
