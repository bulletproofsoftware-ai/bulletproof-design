import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandForPortal } from "@/lib/api";
import { PortalBreadcrumbs } from "@/components/features/PortalBreadcrumbs";
import { TypeSpecimen } from "@/components/features/TypeSpecimen";
import type { TypographyGroup } from "@/lib/types/brand";

/**
 * Portal typography page — REQ-012.
 *
 * Renders two type specimens: Headings (h1..h4) and Body (large/base/
 * small). Each row is a live sample in the declared font with a
 * metadata column. Falls back to a message when the brand has not
 * published typography yet (flat brands without a `typography` field).
 */

interface PortalTypographyProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PortalTypographyProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) return { title: "Brand Portal — Not Found" };
  const title = `${brand.name} — Typography`;
  const description =
    brand.description ?? `Typography specimens for ${brand.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

const HEADING_KEYS = ["h1", "h2", "h3", "h4"] as const;
const BODY_KEYS = ["large", "base", "small"] as const;

const HEADING_SAMPLE = "The quick brown fox";
const BODY_SAMPLE =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";

export default async function PortalTypographyPage({
  params,
}: PortalTypographyProps) {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) notFound();

  const typography = brand.typography;
  const headings = typography?.headings ?? buildHeadingsFromFonts(brand);
  const body = typography?.body ?? buildBodyFromFonts(brand);

  const hasAnyScale = hasScale(headings) || hasScale(body);

  return (
    <>
      <PortalBreadcrumbs
        items={[
          { label: "Brands" },
          { label: brand.name, href: `/portal/${slug}` },
          { label: "Visual Identity", href: `/portal/${slug}` },
          { label: "Typography" },
        ]}
      />
      <h1 className="mb-3 text-[28px] font-normal text-foreground">
        Typography
      </h1>
      <p className="mb-10 max-w-[640px] text-base leading-relaxed text-muted-foreground">
        {brand.fonts?.heading && brand.fonts?.body
          ? `The ${brand.name} brand uses ${brand.fonts.heading} for headings and display text, and ${brand.fonts.body} for body copy and UI elements.`
          : `Typography specimens for ${brand.name}.`}
      </p>

      {!hasAnyScale ? (
        <EmptyState message="This brand has not published typography specimens." />
      ) : (
        <>
          {headings && hasScale(headings) && (
            <SpecimenPanel title={`Headings — ${headings.family}`}>
              {HEADING_KEYS.map((key) => {
                const scale = headings.scale[key];
                if (!scale) return null;
                return (
                  <TypeSpecimen
                    key={key}
                    label={key.toUpperCase()}
                    sample={HEADING_SAMPLE}
                    family={headings.family}
                    size={scale.size}
                    lineHeight={scale.lineHeight}
                    weight={scale.weight}
                  />
                );
              })}
            </SpecimenPanel>
          )}
          {body && hasScale(body) && (
            <SpecimenPanel title={`Body — ${body.family}`}>
              {BODY_KEYS.map((key) => {
                const scale = body.scale[key];
                if (!scale) return null;
                return (
                  <TypeSpecimen
                    key={key}
                    label={toTitleCase(key)}
                    sample={BODY_SAMPLE}
                    family={body.family}
                    size={scale.size}
                    lineHeight={scale.lineHeight}
                    weight={scale.weight}
                  />
                );
              })}
            </SpecimenPanel>
          )}
        </>
      )}
    </>
  );
}

function SpecimenPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-8">
      <h3 className="mb-5 text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div>{children}</div>
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

/**
 * Derive a minimal `headings` TypographyGroup from a flat brand's
 * `fonts.heading` so the page still renders something useful when the
 * brand hasn't been migrated to the expanded schema.
 */
function buildHeadingsFromFonts(brand: {
  fonts?: { heading?: string };
}): TypographyGroup | undefined {
  const family = brand.fonts?.heading;
  if (!family) return undefined;
  return {
    family,
    weights: [400, 500, 700],
    scale: {
      h1: { size: "48px", lineHeight: "1.2", weight: 700 },
      h2: { size: "36px", lineHeight: "1.25", weight: 600 },
      h3: { size: "24px", lineHeight: "1.3", weight: 500 },
      h4: { size: "20px", lineHeight: "1.35", weight: 500 },
    },
  };
}

function buildBodyFromFonts(brand: {
  fonts?: { body?: string };
}): TypographyGroup | undefined {
  const family = brand.fonts?.body;
  if (!family) return undefined;
  return {
    family,
    weights: [400, 500],
    scale: {
      large: { size: "18px", lineHeight: "1.6", weight: 400 },
      base: { size: "16px", lineHeight: "1.5", weight: 400 },
      small: { size: "14px", lineHeight: "1.4", weight: 400 },
    },
  };
}

function hasScale(group?: TypographyGroup): boolean {
  return !!group && !!group.scale && Object.keys(group.scale).length > 0;
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
