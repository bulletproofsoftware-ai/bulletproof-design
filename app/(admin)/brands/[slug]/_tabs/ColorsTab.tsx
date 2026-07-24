"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker } from "@/components/primitives/ColorPicker";
import { Plus, Trash2 } from "lucide-react";
import type * as api from "@/lib/api";
import {
  isRoleGroupedColors,
  type FlatColors,
  type RoleGroupedColors,
  type ColorEntry,
} from "@/lib/types/brand";

const GROUP_KEYS = ["primary", "medium", "light", "neutral"] as const;
type GroupKey = (typeof GROUP_KEYS)[number];

/** Parse a 6-digit hex string to [r,g,b]. Defaults to [0,0,0] when unparseable. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Colors tab — handles both color shapes defined in lib/types/brand.
 *
 * Flat colors (Record<string,string>): two-column ColorPicker grid keyed
 * by the existing keys. Users can rename, delete, or add entries.
 *
 * Role-grouped ({primary, medium, light, neutral}): one card per group.
 * Each row has name, hex (ColorPicker), auto-derived rgb (shown
 * read-only), and a role description. RGB is recomputed whenever hex
 * changes.
 */
export function ColorsTab({
  brand,
  onChange,
}: {
  brand: api.BrandConfig;
  onChange: (next: api.BrandConfig) => void;
}) {
  if (isRoleGroupedColors(brand.colors)) {
    return (
      <RoleGroupedEditor
        colors={brand.colors}
        onChange={(next) => onChange({ ...brand, colors: next })}
      />
    );
  }
  return (
    <FlatEditor
      colors={brand.colors as FlatColors}
      onChange={(next) => onChange({ ...brand, colors: next })}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// Flat editor
// ───────────────────────────────────────────────────────────────────

function FlatEditor({
  colors,
  onChange,
}: {
  colors: FlatColors;
  onChange: (next: FlatColors) => void;
}) {
  const entries = Object.entries(colors);

  function updateKey(oldKey: string, newKey: string) {
    if (!newKey.trim() || newKey === oldKey) return;
    const next: FlatColors = {};
    for (const [k, v] of entries) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  }

  function updateValue(key: string, value: string) {
    onChange({ ...colors, [key]: value });
  }

  function removeEntry(key: string) {
    const next: FlatColors = { ...colors };
    delete next[key];
    onChange(next);
  }

  function addEntry() {
    let i = 1;
    while (`color${i}` in colors) i += 1;
    onChange({ ...colors, [`color${i}`]: "#3b82f6" });
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Colors (flat)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top-level named colors. Renaming a key preserves its value.
          </p>
        </div>
        <Button onClick={addEntry} variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Color
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-end gap-2 rounded-lg border p-3"
          >
            <div className="flex-1 space-y-2">
              <Input
                value={key}
                onChange={(e) => updateKey(key, e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="color-key"
              />
              <ColorPicker
                label=""
                value={value}
                onChange={(v) => updateValue(key, v)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(key)}
              className="mb-1 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${key}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────
// Role-grouped editor
// ───────────────────────────────────────────────────────────────────

function RoleGroupedEditor({
  colors,
  onChange,
}: {
  colors: RoleGroupedColors;
  onChange: (next: RoleGroupedColors) => void;
}) {
  function updateGroup(
    group: GroupKey,
    next: Record<string, ColorEntry> | undefined,
  ) {
    const merged: RoleGroupedColors = { ...colors };
    if (next === undefined || Object.keys(next).length === 0) {
      delete merged[group];
    } else {
      merged[group] = next;
    }
    onChange(merged);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
        <p className="font-semibold">Role-grouped schema</p>
        <p className="mt-1">
          This brand uses the expanded color schema (SPEC-001). Each color
          entry has <code className="font-mono">hex</code>,{" "}
          <code className="font-mono">rgb</code>, and{" "}
          <code className="font-mono">role</code> fields. RGB is derived
          automatically from the hex value.
        </p>
      </div>
      {GROUP_KEYS.map((groupKey) => (
        <GroupCard
          key={groupKey}
          groupKey={groupKey}
          entries={colors[groupKey] ?? {}}
          onChange={(next) => updateGroup(groupKey, next)}
        />
      ))}
    </div>
  );
}

function GroupCard({
  groupKey,
  entries,
  onChange,
}: {
  groupKey: GroupKey;
  entries: Record<string, ColorEntry>;
  onChange: (next: Record<string, ColorEntry>) => void;
}) {
  const rows = Object.entries(entries);

  function updateEntryName(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return;
    const next: Record<string, ColorEntry> = {};
    for (const [k, v] of rows) {
      next[k === oldName ? newName : k] = v;
    }
    onChange(next);
  }

  function updateEntry(name: string, patch: Partial<ColorEntry>) {
    const current = entries[name];
    if (!current) return;
    const merged: ColorEntry = { ...current, ...patch };
    if (patch.hex !== undefined) {
      merged.rgb = hexToRgb(patch.hex);
    }
    onChange({ ...entries, [name]: merged });
  }

  function removeEntry(name: string) {
    const next: Record<string, ColorEntry> = { ...entries };
    delete next[name];
    onChange(next);
  }

  function addEntry() {
    let i = 1;
    while (`color${i}` in entries) i += 1;
    onChange({
      ...entries,
      [`color${i}`]: {
        hex: "#3b82f6",
        rgb: hexToRgb("#3b82f6"),
        role: "",
      },
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize">{groupKey}</h3>
        <Button variant="outline" size="sm" onClick={addEntry}>
          <Plus className="mr-1 h-4 w-4" />
          Add Entry
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No entries in this group yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(([name, entry]) => (
            <div
              key={name}
              className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => updateEntryName(name, e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
              <ColorPicker
                label="Hex"
                value={entry.hex}
                onChange={(v) => updateEntry(name, { hex: v })}
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Role
                </label>
                <Input
                  value={entry.role}
                  onChange={(e) => updateEntry(name, { role: e.target.value })}
                  placeholder="e.g., button.primary"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground font-mono">
                  rgb({entry.rgb.join(", ")})
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(name)}
                className="mb-1 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
