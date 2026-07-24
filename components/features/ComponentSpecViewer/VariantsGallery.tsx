"use client";

/**
 * Variants gallery (SPEC-008 REQ-022, item 4).
 *
 * Grid of iframes, one per variant. Each iframe points at
 * `GET /api/components/:name/preview?variant=<name>` (the server-rendered
 * default-prop preview from SPEC-005). `sandbox="allow-scripts allow-same-origin"`
 * is required because the preview page hydrates React inside the iframe.
 * This is a DIFFERENT sandbox posture from the playground iframe (which
 * uses `allow-scripts` only) — the variants preview is a trusted,
 * server-generated page served from our own Express API.
 *
 * If the component has no variants entries we render a single default-prop
 * iframe (no `?variant=` query).
 */

import type { ComponentSpec } from "@/lib/api";
import { getComponentPreviewUrl } from "@/lib/api";

interface VariantsGalleryProps {
  componentName: string;
  variants: ComponentSpec["variants"];
}

/**
 * Flatten the CVA variant groups into a list of `group=value` pairs. The
 * registry stores variants as `{size: ["sm","md"], variant: ["default",...]}`
 * — each (group, value) is a candidate preview.
 */
function flattenVariants(variants: ComponentSpec["variants"]): Array<{
  group: string;
  value: string;
}> {
  if (!variants) return [];
  const out: Array<{ group: string; value: string }> = [];
  for (const group of Object.keys(variants)) {
    const values = variants[group];
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      out.push({ group, value });
    }
  }
  return out;
}

export function VariantsGallery({ componentName, variants }: VariantsGalleryProps) {
  const baseUrl = getComponentPreviewUrl(componentName);
  const flat = flattenVariants(variants);

  // No variants → single default-prop preview.
  if (flat.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            default
          </div>
          <iframe
            src={baseUrl}
            title={`${componentName} default variant`}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            className="h-[200px] w-full bg-white"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {flat.map((v) => {
        const src = `${baseUrl}?variant=${encodeURIComponent(v.value)}&group=${encodeURIComponent(v.group)}`;
        return (
          <div
            key={`${v.group}:${v.value}`}
            className="overflow-hidden rounded-lg border border-border bg-background"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>
                {v.group}: <span className="text-foreground">{v.value}</span>
              </span>
            </div>
            <iframe
              src={src}
              title={`${componentName} variant ${v.group}=${v.value}`}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              className="h-[200px] w-full bg-white"
            />
          </div>
        );
      })}
    </div>
  );
}
