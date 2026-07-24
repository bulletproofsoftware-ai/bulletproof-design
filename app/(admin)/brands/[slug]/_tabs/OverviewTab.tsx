"use client";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FontPicker } from "@/components/primitives/FontPicker";
import type * as api from "@/lib/api";

const BORDER_RADIUS_KEYS = ["small", "medium", "large", "full"] as const;
const SHADOW_KEYS = ["small", "medium", "large"] as const;

/**
 * Overview tab — edits the flat, non-structural brand fields: identity
 * (name/description), fonts, spacing unit + scale, borderRadius, shadows.
 *
 * Slug is readonly by spec — SPEC-007 §UX Details mentions rename is out
 * of scope. Name is validated to 1..80 chars at save-time by the parent
 * `saveBrand` handler (the server also validates) — we show a soft
 * inline warning here when it's out of range.
 */
export function OverviewTab({
  brand,
  onChange,
}: {
  brand: api.BrandConfig;
  onChange: (next: api.BrandConfig) => void;
}) {
  const nameInvalid = brand.name.length < 1 || brand.name.length > 80;

  return (
    <div className="space-y-8">
      {/* ── Identity ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Identity</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              value={brand.name}
              onChange={(e) => onChange({ ...brand, name: e.target.value })}
              placeholder="Brand name"
              aria-invalid={nameInvalid || undefined}
            />
            {nameInvalid && (
              <p className="text-xs text-destructive">
                Name must be 1–80 characters.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Slug (read-only)
            </label>
            <Input
              value={brand.slug}
              disabled
              readOnly
              className="font-mono text-xs opacity-60"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Input
              value={brand.description ?? ""}
              onChange={(e) =>
                onChange({ ...brand, description: e.target.value })
              }
              placeholder="Short description"
            />
          </div>
        </div>
      </Card>

      {/* ── Fonts (flat convenience block; full scale editing lives on the Typography tab) ── */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Fonts</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Top-level font families used across the brand. For full scale and
          weights, use the <strong>Typography</strong> tab.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <FontPicker
            label="Heading"
            value={brand.fonts.heading}
            onChange={(v) =>
              onChange({ ...brand, fonts: { ...brand.fonts, heading: v } })
            }
            filter="sans"
          />
          <FontPicker
            label="Body"
            value={brand.fonts.body}
            onChange={(v) =>
              onChange({ ...brand, fonts: { ...brand.fonts, body: v } })
            }
            filter="sans"
          />
          <FontPicker
            label="Mono"
            value={brand.fonts.mono ?? "JetBrains Mono"}
            onChange={(v) =>
              onChange({ ...brand, fonts: { ...brand.fonts, mono: v } })
            }
            filter="mono"
          />
        </div>
      </Card>

      {/* ── Spacing ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Spacing</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Unit (px)
            </label>
            <Input
              type="number"
              min={1}
              value={brand.spacing.unit}
              onChange={(e) => {
                const unit = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(unit) && unit > 0) {
                  onChange({
                    ...brand,
                    spacing: { ...brand.spacing, unit },
                  });
                }
              }}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Scale (comma-separated)
            </label>
            <Input
              value={brand.spacing.scale.join(", ")}
              onChange={(e) => {
                const scale = e.target.value
                  .split(",")
                  .map((s) => Number.parseInt(s.trim(), 10))
                  .filter((n) => Number.isFinite(n) && n >= 0);
                onChange({
                  ...brand,
                  spacing: { ...brand.spacing, scale },
                });
              }}
              placeholder="0, 4, 8, 12, 16, 24, 32, 48, 64"
            />
          </div>
        </div>
      </Card>

      {/* ── Border radius ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Border Radius</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {BORDER_RADIUS_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground capitalize">
                {key}
              </label>
              <Input
                value={brand.borderRadius[key]}
                onChange={(e) =>
                  onChange({
                    ...brand,
                    borderRadius: {
                      ...brand.borderRadius,
                      [key]: e.target.value,
                    },
                  })
                }
                placeholder="8px"
                className="font-mono text-xs"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Shadows ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Shadows</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {SHADOW_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground capitalize">
                {key}
              </label>
              <Input
                value={brand.shadows[key]}
                onChange={(e) =>
                  onChange({
                    ...brand,
                    shadows: { ...brand.shadows, [key]: e.target.value },
                  })
                }
                placeholder="0 2px 8px rgba(0,0,0,0.06)"
                className="font-mono text-xs"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
