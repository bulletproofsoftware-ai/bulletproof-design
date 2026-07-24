"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FontPicker } from "@/components/primitives/FontPicker";
import { TagInput } from "@/components/primitives/TagInput";
import { Plus, Trash2 } from "lucide-react";
import type * as api from "@/lib/api";
import type {
  Typography,
  TypographyGroup,
  TypographyScaleEntry,
} from "@/lib/types/brand";

const DEFAULT_HEADINGS: TypographyGroup = {
  family: "Inter",
  weights: [400, 500, 600, 700],
  scale: {
    h1: { size: "2.5rem", lineHeight: "1.2", weight: 700 },
    h2: { size: "2rem", lineHeight: "1.25", weight: 600 },
    h3: { size: "1.5rem", lineHeight: "1.3", weight: 600 },
    h4: { size: "1.25rem", lineHeight: "1.4", weight: 500 },
  },
};

const DEFAULT_BODY: TypographyGroup = {
  family: "Inter",
  weights: [400, 500],
  scale: {
    large: { size: "1.125rem", lineHeight: "1.6", weight: 400 },
    base: { size: "1rem", lineHeight: "1.5", weight: 400 },
    small: { size: "0.875rem", lineHeight: "1.5", weight: 400 },
  },
};

/**
 * Typography tab — edits the `typography.headings` and `typography.body`
 * groups (SPEC-001 REQ-005). Groups are optional: users can enable each
 * one with a button when absent. TagInput captures weights as strings; we
 * leave them as-is on save so numeric and named values both work (the
 * server accepts both per `TypographyGroup.weights`).
 */
export function TypographyTab({
  brand,
  onChange,
}: {
  brand: api.BrandConfig;
  onChange: (next: api.BrandConfig) => void;
}) {
  const typography: Typography = brand.typography ?? {};

  function updateGroup(
    key: "headings" | "body",
    next: TypographyGroup | undefined,
  ) {
    const merged: Typography = { ...typography };
    if (next === undefined) {
      delete merged[key];
    } else {
      merged[key] = next;
    }
    onChange({ ...brand, typography: merged });
  }

  return (
    <div className="space-y-6">
      <GroupEditor
        title="Headings"
        scaleKeysHint="h1, h2, h3, h4"
        defaultFallback={DEFAULT_HEADINGS}
        group={typography.headings}
        onChange={(next) => updateGroup("headings", next)}
      />
      <GroupEditor
        title="Body"
        scaleKeysHint="large, base, small"
        defaultFallback={DEFAULT_BODY}
        group={typography.body}
        onChange={(next) => updateGroup("body", next)}
      />
    </div>
  );
}

function GroupEditor({
  title,
  scaleKeysHint,
  defaultFallback,
  group,
  onChange,
}: {
  title: string;
  scaleKeysHint: string;
  defaultFallback: TypographyGroup;
  group: TypographyGroup | undefined;
  onChange: (next: TypographyGroup | undefined) => void;
}) {
  if (!group) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Not defined yet. Typical keys: {scaleKeysHint}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(defaultFallback)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Enable {title}
          </Button>
        </div>
      </Card>
    );
  }

  const rows = Object.entries(group.scale);

  function updateFamily(family: string) {
    onChange({ ...group!, family });
  }

  function updateWeights(weights: string[]) {
    // Preserve numeric inputs as numbers, named weights stay as strings.
    const parsed = weights.map((w) => {
      const n = Number.parseInt(w, 10);
      return Number.isFinite(n) && String(n) === w.trim() ? n : w;
    });
    onChange({ ...group!, weights: parsed });
  }

  function updateScale(key: string, next: TypographyScaleEntry) {
    onChange({ ...group!, scale: { ...group!.scale, [key]: next } });
  }

  function renameScale(oldKey: string, newKey: string) {
    if (!newKey.trim() || newKey === oldKey) return;
    const nextScale: Record<string, TypographyScaleEntry> = {};
    for (const [k, v] of rows) {
      nextScale[k === oldKey ? newKey : k] = v;
    }
    onChange({ ...group!, scale: nextScale });
  }

  function removeScale(key: string) {
    const nextScale = { ...group!.scale };
    delete nextScale[key];
    onChange({ ...group!, scale: nextScale });
  }

  function addScale() {
    let i = 1;
    while (`key${i}` in group!.scale) i += 1;
    onChange({
      ...group!,
      scale: {
        ...group!.scale,
        [`key${i}`]: { size: "1rem", lineHeight: "1.5", weight: 400 },
      },
    });
  }

  // Live preview sample for the first scale row.
  const firstRow = rows[0];

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(undefined)}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Remove
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <FontPicker
            label="Family"
            value={group.family}
            onChange={updateFamily}
            filter="all"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Weights
            </label>
            <TagInput
              tags={group.weights.map(String)}
              onChange={updateWeights}
              placeholder="e.g., 400"
            />
          </div>
        </div>

        {/* Live preview of the first scale row */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          {firstRow ? (
            <p
              style={{
                fontFamily: group.family,
                fontSize: firstRow[1].size,
                lineHeight: firstRow[1].lineHeight,
                fontWeight: firstRow[1].weight as number,
              }}
            >
              The quick brown fox
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add a scale entry to preview.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Scale</h3>
          <Button variant="outline" size="sm" onClick={addScale}>
            <Plus className="mr-1 h-4 w-4" />
            Add Row
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="rounded border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
            No scale entries defined.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map(([key, entry]) => (
              <div
                key={key}
                className="grid items-end gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">
                    Key
                  </label>
                  <Input
                    value={key}
                    onChange={(e) => renameScale(key, e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">
                    Size
                  </label>
                  <Input
                    value={entry.size}
                    onChange={(e) =>
                      updateScale(key, { ...entry, size: e.target.value })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">
                    Line Height
                  </label>
                  <Input
                    value={entry.lineHeight}
                    onChange={(e) =>
                      updateScale(key, {
                        ...entry,
                        lineHeight: e.target.value,
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">
                    Weight
                  </label>
                  <Input
                    value={String(entry.weight)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const n = Number.parseInt(raw, 10);
                      const w =
                        Number.isFinite(n) && String(n) === raw ? n : raw;
                      updateScale(key, { ...entry, weight: w });
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScale(key)}
                  className="mb-1 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${key}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
