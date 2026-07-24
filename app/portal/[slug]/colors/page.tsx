import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandForPortal } from "@/lib/api";
import { PortalBreadcrumbs } from "@/components/features/PortalBreadcrumbs";
import { ColorSwatch } from "@/components/features/ColorSwatch";
import {
  isRoleGroupedColors,
  type ColorEntry,
  type RoleGroupedColors,
  type FlatColors,
} from "@/lib/types/brand";

/**
 * Portal colors page — REQ-011, REQ-053.
 *
 * Renders the brand's colour palette in either of the two supported
 * shapes:
 *   - **Role-grouped**: primary / medium / light / neutral sections,
 *     each a 4-column swatch grid.
 *   - **Flat** (legacy): a single "Palette" section rendered as a
 *     4-column grid of named swatches.
 *
 * Each swatch is a `ColorSwatch` — click to copy the hex to the clipboard.
 */

interface PortalColorsProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PortalColorsProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) return { title: "Brand Portal — Not Found" };
  const title = `${brand.name} — Colors`;
  const description =
    brand.description ?? `Colour palette and usage for ${brand.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

// Ordered role groups for role-grouped brands.
const ROLE_ORDER: Array<{ key: keyof RoleGroupedColors; label: string }> = [
  { key: "primary", label: "Primary" },
  { key: "medium", label: "Medium" },
  { key: "light", label: "Light" },
  { key: "neutral", label: "Neutral" },
];

export default async function PortalColorsPage({
  params,
}: PortalColorsProps) {
  const { slug } = await params;
  const brand = await getBrandForPortal(slug);
  if (!brand) notFound();

  const colors = brand.colors;
  const roleGrouped = isRoleGroupedColors(colors);

  const totalCount = countColors(colors);

  return (
    <>
      <PortalBreadcrumbs
        items={[
          { label: "Brands" },
          { label: brand.name, href: `/portal/${slug}` },
          { label: "Visual Identity", href: `/portal/${slug}` },
          { label: "Color Palette" },
        ]}
      />
      <h1 className="mb-3 text-[28px] font-normal text-foreground">
        Color Palette
      </h1>
      <p className="mb-10 max-w-[640px] text-base leading-relaxed text-muted-foreground">
        {totalCount > 0
          ? `${countLabel(totalCount)} make up the ${brand.name} color palette. Use these values consistently across all marketing and product materials.`
          : `Colour palette for ${brand.name}.`}
      </p>

      {totalCount === 0 ? (
        <EmptyState message="This brand has not published a colour palette." />
      ) : roleGrouped ? (
        <RoleGroupedPalette colors={colors as RoleGroupedColors} />
      ) : (
        <FlatPalette colors={colors as FlatColors} />
      )}
    </>
  );
}

function countColors(colors: FlatColors | RoleGroupedColors): number {
  if (isRoleGroupedColors(colors)) {
    let n = 0;
    for (const group of Object.values(colors)) {
      if (group && typeof group === "object") {
        n += Object.keys(group).length;
      }
    }
    return n;
  }
  return Object.values(colors).filter((v) => typeof v === "string").length;
}

function countLabel(n: number): string {
  const words: Record<number, string> = {
    1: "One colour",
    2: "Two colours",
    3: "Three colours",
    4: "Four colours",
    5: "Five colours",
    6: "Six colours",
    7: "Seven colours",
    8: "Eight colours",
    9: "Nine colours",
    10: "Ten colours",
    11: "Eleven colours",
    12: "Twelve colours",
  };
  return words[n] ?? `${n} colours`;
}

function RoleGroupedPalette({ colors }: { colors: RoleGroupedColors }) {
  return (
    <>
      {ROLE_ORDER.map(({ key, label }) => {
        const group = colors[key];
        if (!group || Object.keys(group).length === 0) return null;
        return (
          <section key={key} className="mb-8">
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(group).map(([name, entry]) => (
                <ColorSwatch
                  key={name}
                  name={toTitleCase(name)}
                  hex={(entry as ColorEntry).hex}
                  rgb={(entry as ColorEntry).rgb}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function FlatPalette({ colors }: { colors: FlatColors }) {
  const entries = Object.entries(colors).filter(
    ([, hex]) => typeof hex === "string" && hex.length > 0,
  );
  return (
    <section className="mb-8">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Palette
      </h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {entries.map(([name, hex]) => (
          <ColorSwatch key={name} name={toTitleCase(name)} hex={hex} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function toTitleCase(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
