"use client";

import { isRoleGroupedColors, extractPrimaryColor } from "@/lib/types/brand";
import type { BrandConfig } from "@/lib/types/brand";

/**
 * BrandCard renders a small tile for a brand in grids. Accepts the summary
 * payload from `/api/brands` (name/slug/description/primaryColor) and
 * optionally a full `BrandConfig` for richer rendering.
 *
 * For role-grouped brands (REQ-003), it shows the first color of the first
 * non-empty group as the primary swatch plus a count badge of total entries.
 */
interface BrandCardProps {
  name: string;
  slug: string;
  description?: string;
  primaryColor?: string;
  /** Optional — pass the full brand to enable role-grouped rendering. */
  brand?: Pick<BrandConfig, "colors">;
  onClick?: () => void;
}

function countRoleGroupedEntries(colors: BrandConfig["colors"]): number {
  if (!isRoleGroupedColors(colors)) return 0;
  let total = 0;
  for (const group of Object.values(colors)) {
    if (group && typeof group === "object") {
      total += Object.keys(group).length;
    }
  }
  return total;
}

export function BrandCard({
  name,
  slug,
  description,
  primaryColor,
  brand,
  onClick,
}: BrandCardProps) {
  const resolvedColor = brand
    ? extractPrimaryColor(brand.colors)
    : (primaryColor ?? "#3b82f6");
  const validColor = /^#[0-9a-fA-F]{3,8}$/.test(resolvedColor);

  const grouped = brand ? isRoleGroupedColors(brand.colors) : false;
  const entryCount = brand ? countRoleGroupedEntries(brand.colors) : 0;

  return (
    <div className="template-card" onClick={onClick}>
      <div className="flex items-start gap-4">
        <div
          className="mt-0.5 h-10 w-10 shrink-0 rounded-lg"
          style={{ backgroundColor: validColor ? resolvedColor : "var(--ds-brand-primary)" }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{name}</h3>
            {grouped && entryCount > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {entryCount} colors
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{slug}</p>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
