import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBrandForPortal,
  getBrandAssetsForPortal,
} from "@/lib/api";
import { PortalBreadcrumbs } from "@/components/features/PortalBreadcrumbs";
import { LogoLockupCard } from "@/components/features/LogoLockupCard";
import type { Logos, LogoEntry } from "@/lib/types/brand";

/**
 * Portal overview page — REQ-010.
 *
 * Renders the brand's logo lockups (horizontal, vertical, icon) with
 * usage labels, preferred badge, and download buttons. Falls back to a
 * friendly empty state when the brand hasn't published any logos yet
 * (typical for flat-format brands migrated before SPEC-001).
 */

interface PortalOverviewProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PortalOverviewProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) return { title: "Brand Portal — Not Found" };

  const description =
    brand.description ?? `Visual identity guidelines for ${brand.name}.`;
  const title = `${brand.name} — Overview`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

const LOGO_ORDER: Array<keyof Logos> = ["horizontal", "vertical", "icon"];

const LOGO_DEFAULTS: Record<
  keyof Logos,
  { label: string; usage: string }
> = {
  horizontal: {
    label: "Horizontal logo lockup",
    usage: "The primary logo for most marketing materials and product surfaces.",
  },
  vertical: {
    label: "Vertical logo lockup",
    usage: "For space-constrained contexts where horizontal layout doesn't fit.",
  },
  icon: {
    label: "Icon",
    usage:
      "App icon representation only. Do not use as a standalone brand mark in marketing.",
  },
};

export default async function PortalOverviewPage({
  params,
}: PortalOverviewProps) {
  const { slug } = await params;
  const [brand, assetsRes] = await Promise.all([
    getBrandForPortal(slug),
    getBrandAssetsForPortal(slug),
  ]);
  if (!brand) notFound();

  const assets = assetsRes?.assets ?? {};
  const logos = brand.logos ?? assetsRes?.logos;

  // Build the list of logo cards. When the brand is directory-format with a
  // `logos` manifest we honour the entries and their preferred flags.
  // Otherwise fall back to the legacy `assets` map (flat brands) and render
  // whatever keys resolve to a URL.
  const logoCards = buildLogoCards({
    brandName: brand.name,
    logos,
    assets,
  });

  return (
    <>
      <PortalBreadcrumbs
        items={[
          { label: "Brands" },
          { label: brand.name, href: `/portal/${slug}` },
          { label: "Visual Identity" },
        ]}
      />
      <h1 className="mb-3 text-[28px] font-normal text-foreground">
        Visual Identity
      </h1>
      <p className="mb-10 max-w-[640px] text-base leading-relaxed text-muted-foreground">
        {brand.description ??
          `Guidance for using ${brand.name} brand assets, including logos and icons, as you build effective marketing campaigns and product experiences.`}
      </p>

      <SectionLabel>Logo Assets</SectionLabel>

      {logoCards.length === 0 ? (
        <EmptyState message="No logos published yet." />
      ) : (
        logoCards.map((card) => (
          <LogoLockupCard
            key={`${card.label}-${card.url}`}
            url={card.url}
            label={card.label}
            usage={card.usage}
            preferred={card.preferred}
            downloadName={card.downloadName}
          />
        ))
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-medium uppercase tracking-[1px] text-muted-foreground">
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

interface LogoCard {
  url: string;
  label: string;
  usage: string;
  preferred?: boolean;
  downloadName?: string;
}

function buildLogoCards({
  brandName,
  logos,
  assets,
}: {
  brandName: string;
  logos?: Logos;
  assets: Record<string, string>;
}): LogoCard[] {
  const cards: LogoCard[] = [];

  // Directory-format brands: render every declared logo variant in the
  // preferred order (horizontal → vertical → icon) even if some are
  // missing. Missing variants are skipped silently.
  if (logos) {
    for (const key of LOGO_ORDER) {
      const entry = logos[key];
      if (!entry) continue;
      const url = resolveLogoUrl(entry, key, assets);
      if (!url) continue;
      cards.push({
        url,
        label: entry.label ?? LOGO_DEFAULTS[key].label,
        usage: entry.usage ?? LOGO_DEFAULTS[key].usage,
        preferred: entry.preferred,
        downloadName: entry.file ?? `${brandName}-${key}`,
      });
    }
    return cards;
  }

  // Flat brands: fall back to legacy logo keys (`mark`, `horizontal`,
  // `favicon`) exposed through the `/assets` endpoint.
  const legacyMap: Array<{ key: keyof Logos; assetKey: string }> = [
    { key: "horizontal", assetKey: "horizontal" },
    { key: "vertical", assetKey: "vertical" },
    { key: "icon", assetKey: "mark" },
  ];
  for (const { key, assetKey } of legacyMap) {
    const url = assets[assetKey];
    if (typeof url !== "string" || url.length === 0) continue;
    cards.push({
      url,
      label: LOGO_DEFAULTS[key].label,
      usage: LOGO_DEFAULTS[key].usage,
      downloadName: `${brandName}-${key}`,
    });
  }
  return cards;
}

/**
 * Resolve a logo URL from a manifest entry.
 *
 * The directory format stores `file: "horizontal-logo.svg"`. The API's
 * `/assets` response already maps that file's basename (without extension)
 * to a URL, so we look it up there. If the entry's file is literally a
 * URL (future-proofing for remote asset stores), return it verbatim.
 */
function resolveLogoUrl(
  entry: LogoEntry,
  key: keyof Logos,
  assets: Record<string, string>,
): string | null {
  if (!entry.file) return null;
  if (/^https?:\/\//i.test(entry.file)) return entry.file;

  // Try exact filename match (without extension) first.
  const nameNoExt = entry.file.replace(/\.[a-z0-9]+$/i, "");
  if (assets[nameNoExt]) return assets[nameNoExt];

  // Fall back to the logo-variant key (horizontal/vertical/icon).
  if (assets[key]) return assets[key];

  return null;
}
