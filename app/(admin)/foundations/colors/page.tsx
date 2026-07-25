"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";
const FETCH_TIMEOUT_MS = 10_000;

const CORE_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "textMuted",
  "border",
  "error",
  "warning",
  "success",
] as const;

const CORE_COLOR_KEYS_SET = new Set<string>(CORE_COLOR_KEYS);

const COLOR_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  textMuted: "Text Muted",
  border: "Border",
  error: "Error",
  warning: "Warning",
  success: "Success",
};

function labelForKey(key: string): string {
  if (COLOR_LABELS[key]) return COLOR_LABELS[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return `#${trimmed}`;
  return trimmed;
}

interface BrandSummary {
  name: string;
  slug: string;
  description: string;
  primaryColor: string;
}

interface BrandConfig {
  name: string;
  slug: string;
  description: string;
  primaryColor: string;
  colors: Record<string, string>;
  typography?: Record<string, unknown>;
  [key: string]: unknown;
}

interface BrandState {
  summary: BrandSummary;
  config: BrandConfig | null;
  css: string;
  editedColors: Record<string, string>;
  dirty: boolean;
  saving: boolean;
  saveResult: { ok: boolean; message: string } | null;
}

async function fetchWithTimeout<T>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function fetchCssVariables(slug: string): Promise<string> {
  try {
    const data = await fetchWithTimeout<Record<string, unknown>>(
      `${API}/api/brands/${slug}/css-variables`
    );
    if (!data) return "";
    if (typeof data === "object" && "css" in data && typeof data.css === "string")
      return data.css;
    if (typeof data === "object" && "variables" in data && data.variables) {
      return `:root {\n${Object.entries(data.variables as Record<string, string>)
        .map(([k, v]) => `  ${k}: ${v};`)
        .join("\n")}\n}`;
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return "";
  }
}

function Toast({
  message,
  ok,
  onDismiss,
}: {
  message: string;
  ok: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
        ok
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {ok ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}
      {message}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
        <X className="size-3" />
      </button>
    </div>
  );
}

function ColorSwatch({
  hex,
  label,
  isCore,
  onEdit,
  onDelete,
}: {
  hex: string;
  label: string;
  isCore: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const light = isLightColor(hex);
  const textColor = light ? "#1e293b" : "#f8fafc";

  return (
    <div className="text-center group relative">
      <button
        type="button"
        onClick={onEdit}
        className="h-16 w-full rounded-lg border border-border shadow-sm flex items-end justify-center pb-1.5 cursor-pointer transition-all hover:ring-2 hover:ring-ring hover:ring-offset-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 outline-none relative"
        style={{ backgroundColor: hex }}
        title={`Edit ${label}`}
      >
        <span
          className="text-[10px] font-mono font-medium"
          style={{ color: textColor }}
        >
          {hex}
        </span>
        <span
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          <Pencil className="size-3" />
        </span>
      </button>
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {!isCore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            title={`Delete ${label}`}
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function EditColorDialog({
  open,
  colorKey,
  initialHex,
  onSave,
  onCancel,
}: {
  open: boolean;
  colorKey: string;
  initialHex: string;
  onSave: (hex: string) => void;
  onCancel: () => void;
}) {
  const [hex, setHex] = useState(initialHex);
  const [valid, setValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHex(initialHex);
    setValid(true);
  }, [initialHex, open]);

  function handleHexChange(value: string) {
    const normalized = normalizeHex(value);
    setHex(normalized);
    setValid(isValidHex(normalized));
  }

  function handleSubmit() {
    if (valid && hex) {
      onSave(hex.toLowerCase());
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Color: {labelForKey(colorKey)}</DialogTitle>
          <DialogDescription>
            Change the hex value for the <strong>{colorKey}</strong> token.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={hex.length === 7 ? hex : "#000000"}
              onChange={(e) => handleHexChange(e.target.value)}
              className="h-12 w-12 shrink-0 cursor-pointer rounded-md border border-border p-0.5"
            />
            <div className="flex-1">
              <Input
                ref={inputRef}
                value={hex}
                onChange={(e) => handleHexChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="#000000"
                className={!valid ? "border-destructive" : ""}
              />
              {!valid && (
                <p className="text-xs text-destructive mt-1">
                  Enter a valid hex color (e.g. #ff5500)
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <div
              className="h-8 flex-1 rounded-md border border-border"
              style={{ backgroundColor: valid ? hex : "#cccccc" }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={handleSubmit}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddColorDialog({
  open,
  existingKeys,
  onAdd,
  onCancel,
}: {
  open: boolean;
  existingKeys: string[];
  onAdd: (key: string, hex: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [hex, setHex] = useState("#000000");
  const [hexValid, setHexValid] = useState(true);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    if (open) {
      setKey("");
      setHex("#000000");
      setHexValid(true);
      setKeyError("");
    }
  }, [open]);

  function validateKey(value: string) {
    if (!value.trim()) {
      setKeyError("Token name is required");
      return false;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(value)) {
      setKeyError("Use camelCase, letters and numbers only");
      return false;
    }
    if (existingKeys.includes(value)) {
      setKeyError("This token name already exists");
      return false;
    }
    setKeyError("");
    return true;
  }

  function handleHexChange(value: string) {
    const normalized = normalizeHex(value);
    setHex(normalized);
    setHexValid(isValidHex(normalized));
  }

  function handleSubmit() {
    const keyOk = validateKey(key);
    const hexOk = isValidHex(hex);
    if (keyOk && hexOk) {
      onAdd(key, hex.toLowerCase());
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Color Token</DialogTitle>
          <DialogDescription>
            Add a new custom color token to this brand.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Token Name
            </label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                if (keyError) validateKey(e.target.value);
              }}
              onBlur={() => key && validateKey(key)}
              placeholder="e.g. brandHighlight"
              className={keyError ? "border-destructive" : ""}
            />
            {keyError && (
              <p className="text-xs text-destructive mt-1">{keyError}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Color Value
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={hex.length === 7 ? hex : "#000000"}
                onChange={(e) => handleHexChange(e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-border p-0.5"
              />
              <Input
                value={hex}
                onChange={(e) => handleHexChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="#000000"
                className={!hexValid ? "border-destructive" : ""}
              />
            </div>
            {!hexValid && (
              <p className="text-xs text-destructive mt-1">
                Enter a valid hex color (e.g. #ff5500)
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <div
              className="h-8 flex-1 rounded-md border border-border"
              style={{ backgroundColor: hexValid ? hex : "#cccccc" }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Token</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  colorKey,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  colorKey: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Color Token</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{" "}
            <strong>{labelForKey(colorKey)}</strong> token? This will be saved
            when you click Save.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandColorEditor({ brand }: { brand: BrandState }) {
  const [editedColors, setEditedColors] = useState<Record<string, string>>(
    brand.editedColors
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [css, setCss] = useState(brand.css);

  const [editDialog, setEditDialog] = useState<{
    key: string;
    hex: string;
  } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  function handleEditSave(hex: string) {
    if (!editDialog) return;
    setEditedColors((prev) => ({ ...prev, [editDialog.key]: hex }));
    setDirty(true);
    setEditDialog(null);
  }

  function handleAddToken(key: string, hex: string) {
    setEditedColors((prev) => ({ ...prev, [key]: hex }));
    setDirty(true);
    setAddDialogOpen(false);
  }

  function handleDeleteConfirm() {
    if (!deleteDialog) return;
    setEditedColors((prev) => {
      const next = { ...prev };
      delete next[deleteDialog];
      return next;
    });
    setDirty(true);
    setDeleteDialog(null);
  }

  const handleSave = useCallback(async () => {
    if (!brand.config) return;
    setSaving(true);
    setSaveResult(null);

    const updatedConfig = {
      ...brand.config,
      colors: { ...editedColors },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      // Writes require x-api-key whenever DESIGN_API_KEY is set on the API,
      // and always in production. The key is stored by the brand editor.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let storedKey = "";
      try {
        storedKey = window.localStorage.getItem("design-api-key") ?? "";
      } catch {
        /* localStorage unavailable */
      }
      if (storedKey) headers["x-api-key"] = storedKey;

      const res = await fetch(`${API}/api/brands/${brand.summary.slug}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatedConfig),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        setSaveResult({ ok: true, message: `${brand.summary.name} colors saved` });
        setDirty(false);
        const newCss = await fetchCssVariables(brand.summary.slug);
        setCss(newCss);
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMsg =
          errorData?.error || errorData?.message || `Save failed (${res.status})`;
        setSaveResult({ ok: false, message: errorMsg });
      }
    } catch (err) {
      setSaveResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSaving(false);
    }
  }, [brand.config, brand.summary.slug, brand.summary.name, editedColors]);

  const allColorKeys = Object.keys(editedColors);
  const coreKeys = CORE_COLOR_KEYS.filter((k) => k in editedColors);
  const customKeys = allColorKeys.filter((k) => !CORE_COLOR_KEYS_SET.has(k));

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          {brand.summary.name}
        </h2>
        <Badge variant="secondary" className="text-xs">
          {brand.summary.slug}
        </Badge>
        {dirty && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* Color swatches */}
      <div className="stat-card card-blue mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Palette</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="size-3" />
              Add Token
            </Button>
            <Button
              size="xs"
              disabled={!dirty || saving}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Core color tokens */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {coreKeys.map((key) => {
            const hex = editedColors[key] || "#cccccc";
            return (
              <ColorSwatch
                key={key}
                hex={hex}
                label={labelForKey(key)}
                isCore={true}
                onEdit={() => setEditDialog({ key, hex })}
                onDelete={() => {}}
              />
            );
          })}
        </div>

        {/* Custom color tokens */}
        {customKeys.length > 0 && (
          <>
            <div className="mt-4 mb-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Custom Tokens
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {customKeys.map((key) => {
                const hex = editedColors[key] || "#cccccc";
                return (
                  <ColorSwatch
                    key={key}
                    hex={hex}
                    label={labelForKey(key)}
                    isCore={false}
                    onEdit={() => setEditDialog({ key, hex })}
                    onDelete={() => setDeleteDialog(key)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* CSS Variables */}
      {css && (
        <div className="stat-card card-purple">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            CSS Variables
          </h3>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
            {css}
          </pre>
        </div>
      )}

      {/* Edit dialog */}
      <EditColorDialog
        open={editDialog !== null}
        colorKey={editDialog?.key || ""}
        initialHex={editDialog?.hex || "#000000"}
        onSave={handleEditSave}
        onCancel={() => setEditDialog(null)}
      />

      {/* Add dialog */}
      <AddColorDialog
        open={addDialogOpen}
        existingKeys={allColorKeys}
        onAdd={handleAddToken}
        onCancel={() => setAddDialogOpen(false)}
      />

      {/* Delete confirm dialog */}
      <DeleteConfirmDialog
        open={deleteDialog !== null}
        colorKey={deleteDialog || ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog(null)}
      />

      {/* Toast notification */}
      {saveResult && (
        <Toast
          message={saveResult.message}
          ok={saveResult.ok}
          onDismiss={() => setSaveResult(null)}
        />
      )}
    </div>
  );
}

export default function ColorsPage() {
  const [brands, setBrands] = useState<BrandState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const brandsData = await fetchWithTimeout<{ brands: BrandSummary[] }>(
        `${API}/api/brands`
      );

      if (cancelled) return;

      if (!brandsData?.brands || brandsData.brands.length === 0) {
        setBrands([]);
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          brandsData.brands.map(async (b) => {
            const [config, css] = await Promise.all([
              fetchWithTimeout<BrandConfig>(`${API}/api/brands/${b.slug}`),
              fetchCssVariables(b.slug),
            ]);
            return {
              summary: b,
              config,
              css,
              editedColors: config?.colors ? { ...config.colors } : {},
              dirty: false,
              saving: false,
              saveResult: null,
            } satisfies BrandState;
          })
        );

        if (!cancelled) {
          setBrands(results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load brand data"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Foundations", href: "/foundations/colors" },
          { label: "Colors & Tokens" },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Colors & Tokens
      </h1>
      <p className="text-muted-foreground mb-8">
        Color palettes and CSS custom properties for each brand in the library.
        Click any swatch to edit its value.
      </p>

      {loading && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" />
          Loading brands...
        </div>
      )}

      {!loading && error && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-destructive text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No brands found. Create a brand to see its color tokens here.
        </div>
      )}

      {!loading &&
        !error &&
        brands.map((brand) => (
          <BrandColorEditor key={brand.summary.slug} brand={brand} />
        ))}
    </div>
  );
}
