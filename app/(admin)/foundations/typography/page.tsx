"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";
const FETCH_TIMEOUT_MS = 10_000;

const CORE_FONT_KEYS = new Set(["heading", "body", "mono"]);

interface BrandSummary {
  name: string;
  slug: string;
}

interface BrandConfig {
  name: string;
  slug: string;
  fonts: Record<string, string>;
  [key: string]: unknown;
}

interface HeadingSize {
  label: string;
  size: string;
}

interface BrandFontState {
  fonts: Record<string, string>;
  headingSizes: HeadingSize[];
  dirty: boolean;
  saving: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
}

const DEFAULT_HEADING_SIZES: HeadingSize[] = [
  { label: "H1", size: "3rem" },
  { label: "H2", size: "2.25rem" },
  { label: "H3", size: "1.75rem" },
  { label: "H4", size: "1.5rem" },
  { label: "H5", size: "1.25rem" },
  { label: "H6", size: "1rem" },
];

const SAMPLE_PARAGRAPH =
  "The quick brown fox jumps over the lazy dog. Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. Good typography establishes a strong visual hierarchy and provides a balanced graphic flow.";

const SAMPLE_CODE = `function greet(name: string): string {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}`;

const BADGE_COLORS: Record<string, string> = {
  heading: "bg-blue-100 text-blue-700 border-blue-200",
  body: "bg-purple-100 text-purple-700 border-purple-200",
  mono: "bg-teal-100 text-teal-700 border-teal-200",
};

const DEFAULT_BADGE_COLOR = "bg-orange-100 text-orange-700 border-orange-200";

function badgeColor(key: string): string {
  return BADGE_COLORS[key] ?? DEFAULT_BADGE_COLOR;
}

async function fetchWithTimeout<T>(
  url: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function EditableField({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`group inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer ${className ?? ""}`}
        title="Click to edit"
      >
        <span>{value}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="h-7 w-40 text-sm"
      />
    </span>
  );
}

function EditableSizeField({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono hover:text-primary transition-colors cursor-pointer"
        title="Click to edit size"
      >
        <span>{value}</span>
        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      onBlur={commit}
      className="h-5 w-16 text-[11px] font-mono px-1"
    />
  );
}

function AddFontDialog({
  open,
  onOpenChange,
  onAdd,
  existingKeys,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (key: string, family: string) => void;
  existingKeys: string[];
}) {
  const [key, setKey] = useState("");
  const [family, setFamily] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setKey("");
    setFamily("");
    setError("");
  }

  function handleAdd() {
    const trimmedKey = key.trim().toLowerCase().replace(/\s+/g, "-");
    const trimmedFamily = family.trim();
    if (!trimmedKey) {
      setError("Category name is required.");
      return;
    }
    if (!trimmedFamily) {
      setError("Font family is required.");
      return;
    }
    if (existingKeys.includes(trimmedKey)) {
      setError(`Category "${trimmedKey}" already exists.`);
      return;
    }
    onAdd(trimmedKey, trimmedFamily);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Font Category</DialogTitle>
          <DialogDescription>
            Add a custom font category beyond the core heading, body, and mono
            fonts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Category Name
            </label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError("");
              }}
              placeholder="e.g. display, caption, accent"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Font Family
            </label>
            <Input
              value={family}
              onChange={(e) => {
                setFamily(e.target.value);
                setError("");
              }}
              placeholder="e.g. Playfair Display, Oswald"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Category</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrandTypography({
  brand,
  config,
}: {
  brand: BrandSummary;
  config: BrandConfig;
}) {
  const [state, setState] = useState<BrandFontState>(() => ({
    fonts: config.fonts || { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    headingSizes: [...DEFAULT_HEADING_SIZES],
    dirty: false,
    saving: false,
    feedback: null,
  }));

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function clearFeedback() {
    setState((s) => ({ ...s, feedback: null }));
  }

  function updateFont(key: string, value: string) {
    setState((s) => ({
      ...s,
      fonts: { ...s.fonts, [key]: value },
      dirty: true,
      feedback: null,
    }));
  }

  function addFont(key: string, family: string) {
    setState((s) => ({
      ...s,
      fonts: { ...s.fonts, [key]: family },
      dirty: true,
      feedback: null,
    }));
  }

  function deleteFont(key: string) {
    setState((s) => {
      const next = { ...s.fonts };
      delete next[key];
      return { ...s, fonts: next, dirty: true, feedback: null };
    });
    setConfirmDelete(null);
  }

  function updateHeadingSize(index: number, size: string) {
    setState((s) => {
      const next = [...s.headingSizes];
      next[index] = { ...next[index], size };
      return { ...s, headingSizes: next, dirty: true, feedback: null };
    });
  }

  const save = useCallback(async () => {
    setState((s) => ({ ...s, saving: true, feedback: null }));
    try {
      const updatedConfig = {
        ...config,
        fonts: state.fonts,
      };
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

      const res = await fetchWithTimeout<BrandConfig>(
        `${API}/api/brands/${brand.slug}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(updatedConfig),
        }
      );
      if (res) {
        setState((s) => ({
          ...s,
          saving: false,
          dirty: false,
          feedback: { type: "success", message: "Saved successfully" },
        }));
        setTimeout(clearFeedback, 3000);
      } else {
        setState((s) => ({
          ...s,
          saving: false,
          feedback: { type: "error", message: "Failed to save. Check the API server." },
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        saving: false,
        feedback: { type: "error", message: "Network error while saving." },
      }));
    }
  }, [brand.slug, config, state.fonts]);

  const fontKeys = Object.keys(state.fonts);

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold text-foreground">{brand.name}</h2>
        <Badge variant="secondary" className="text-xs">
          {brand.slug}
        </Badge>
      </div>

      {/* Font badges with inline editing */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        {fontKeys.map((key) => (
          <span
            key={key}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeColor(key)}`}
          >
            <span className="capitalize">{key}:</span>
            <EditableField
              value={state.fonts[key]}
              onSave={(v) => updateFont(key, v)}
              className="text-xs"
            />
            {!CORE_FONT_KEYS.has(key) && (
              <button
                type="button"
                onClick={() => setConfirmDelete(key)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-red-200 transition-colors"
                title={`Delete ${key} font`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <Button
          variant="outline"
          size="xs"
          onClick={() => setAddDialogOpen(true)}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Font
        </Button>
      </div>

      {/* Save row */}
      <div className="flex items-center gap-3 mb-5">
        <Button
          size="sm"
          onClick={save}
          disabled={!state.dirty || state.saving}
          className="gap-1.5"
        >
          {state.saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {state.saving ? "Saving..." : "Save"}
        </Button>
        {state.feedback && (
          <span
            className={`inline-flex items-center gap-1 text-sm font-medium ${
              state.feedback.type === "success"
                ? "text-green-600"
                : "text-destructive"
            }`}
          >
            {state.feedback.type === "success" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {state.feedback.message}
          </span>
        )}
      </div>

      {/* Heading font preview */}
      <div className="stat-card card-blue mb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Heading Font —{" "}
          <EditableField
            value={state.fonts.heading ?? "Inter"}
            onSave={(v) => updateFont("heading", v)}
            className="text-sm font-medium text-muted-foreground"
          />
        </h3>
        <div className="space-y-3">
          {state.headingSizes.map((h, i) => (
            <div key={h.label} className="flex items-baseline gap-4">
              <span className="text-[11px] text-muted-foreground w-28 shrink-0 font-mono flex items-center gap-1.5">
                {h.label} —{" "}
                <EditableSizeField
                  value={h.size}
                  onSave={(v) => updateHeadingSize(i, v)}
                />
              </span>
              <span
                className="font-bold text-foreground leading-tight truncate"
                style={{
                  fontFamily: state.fonts.heading ?? "Inter",
                  fontSize: h.size,
                }}
              >
                The quick brown fox
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Body font preview */}
      <div className="stat-card card-purple mb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Body Font —{" "}
          <EditableField
            value={state.fonts.body ?? "Inter"}
            onSave={(v) => updateFont("body", v)}
            className="text-sm font-medium text-muted-foreground"
          />
        </h3>
        <p
          className="text-base leading-relaxed text-foreground"
          style={{ fontFamily: state.fonts.body ?? "Inter" }}
        >
          {SAMPLE_PARAGRAPH}
        </p>
      </div>

      {/* Mono font preview */}
      <div className="stat-card card-teal mb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Monospace Font —{" "}
          <EditableField
            value={state.fonts.mono ?? "JetBrains Mono"}
            onSave={(v) => updateFont("mono", v)}
            className="text-sm font-medium text-muted-foreground"
          />
        </h3>
        <pre
          className="rounded-lg bg-slate-900 text-slate-100 p-4 text-sm overflow-x-auto"
          style={{ fontFamily: state.fonts.mono ?? "JetBrains Mono" }}
        >
          {SAMPLE_CODE}
        </pre>
      </div>

      {/* Custom font previews */}
      {fontKeys
        .filter((k) => !CORE_FONT_KEYS.has(k))
        .map((key) => (
          <div key={key} className="stat-card mb-4 border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                <span className="capitalize">{key}</span> Font —{" "}
                <EditableField
                  value={state.fonts[key]}
                  onSave={(v) => updateFont(key, v)}
                  className="text-sm font-medium text-muted-foreground"
                />
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setConfirmDelete(key)}
                className="text-muted-foreground hover:text-destructive"
                title={`Delete ${key}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p
              className="text-lg leading-relaxed text-foreground"
              style={{ fontFamily: state.fonts[key] }}
            >
              The quick brown fox jumps over the lazy dog. ABCDEFGHIJKLMNOPQRSTUVWXYZ
              abcdefghijklmnopqrstuvwxyz 0123456789
            </p>
          </div>
        ))}

      {/* Add font dialog */}
      <AddFontDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={addFont}
        existingKeys={fontKeys}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Font Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the{" "}
              <strong className="text-foreground">{confirmDelete}</strong> font
              category? This will be persisted when you save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteFont(confirmDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TypographyPage() {
  const [brands, setBrands] = useState<
    { summary: BrandSummary; config: BrandConfig }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const data = await fetchWithTimeout<{ brands: BrandSummary[] }>(
        `${API}/api/brands`
      );

      if (cancelled) return;

      if (!data || !data.brands) {
        setError("Could not load brands from the API.");
        setLoading(false);
        return;
      }

      const configs = await Promise.all(
        data.brands.map(async (b) => {
          const config = await fetchWithTimeout<BrandConfig>(
            `${API}/api/brands/${b.slug}`
          );
          return { summary: b, config };
        })
      );

      if (cancelled) return;

      setBrands(
        configs.filter(
          (c): c is { summary: BrandSummary; config: BrandConfig } =>
            c.config !== null
        )
      );
      setLoading(false);
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
          { label: "Typography" },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-2">Typography</h1>
      <p className="text-muted-foreground mb-8">
        Font stacks and type scale previews for each brand. Click any font name
        or size to edit it.
      </p>

      {loading && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading brands...
        </div>
      )}

      {!loading && error && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No brands found. Create a brand to see its typography here.
        </div>
      )}

      {!loading &&
        !error &&
        brands.map(({ summary, config }) => (
          <BrandTypography
            key={summary.slug}
            brand={summary}
            config={config}
          />
        ))}
    </div>
  );
}
