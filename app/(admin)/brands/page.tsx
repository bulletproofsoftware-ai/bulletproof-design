"use client";

import { useState, useEffect , useRef } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ColorPicker } from "@/components/primitives/ColorPicker";
import { FontPicker } from "@/components/primitives/FontPicker";
import { BrandCard } from "@/components/features/BrandCard";
import { Plus, Trash2, Upload, X, SlidersHorizontal } from "lucide-react";
import * as api from "@/lib/api";
import { isRoleGroupedColors } from "@/lib/types/brand";

const DEFAULT_BRAND: api.BrandConfig = {
  name: "",
  slug: "",
  description: "",
  logo: { mark: "", horizontal: "", favicon: "" },
  colors: {
    primary: "#3b82f6",
    secondary: "#1e293b",
    accent: "#10b981",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    error: "#ef4444",
    warning: "#f59e0b",
    success: "#22c55e",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  spacing: { unit: 4, scale: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96] },
  borderRadius: {
    small: "4px",
    medium: "8px",
    large: "12px",
    full: "9999px",
  },
  shadows: {
    small: "0 1px 2px rgba(0,0,0,0.05)",
    medium: "0 4px 6px rgba(0,0,0,0.07)",
    large: "0 10px 15px rgba(0,0,0,0.1)",
  },
};

const COLOR_LABELS: Record<keyof api.BrandColors, string> = {
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function LogoUploadCard({
  label,
  currentUrl,
  onUpload,
  onRemove,
}: {
  label: string;
  currentUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3">
      {/* Preview */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted/50">
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="max-h-12 max-w-12 object-contain" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info + actions */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {currentUrl ? "Click replace to change" : "No logo uploaded"}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "..." : currentUrl ? "Replace" : "Upload"}
        </Button>
        {currentUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<api.BrandSummary[]>([]);
  const [brand, setBrand] = useState<api.BrandConfig>({ ...DEFAULT_BRAND });
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState("");
  const [logoAssets, setLogoAssets] = useState<Record<string, string>>({});
  const [roleGroupedSlug, setRoleGroupedSlug] = useState<string | null>(null);

  async function loadBrands() {
    try {
      const list = await api.getBrands();
      setBrands(list);
    } catch (err: any) {
      console.error("Failed to load brands:", err);
    }
  }

  useEffect(() => {
    loadBrands();
  }, []);

  async function openNew() {
    setBrand({ ...DEFAULT_BRAND });
    setMode("new");
    setStatus("idle");
    setError("");
    setLogoAssets({});
    setSheetOpen(true);
  }

  async function openEdit(slug: string) {
    try {
      const full = await api.getBrand(slug);

      // Role-grouped brands are not editable by the legacy flat sheet. Show
      // a notice instead of opening an editor that would mangle data.
      if (isRoleGroupedColors(full.colors as unknown as Parameters<typeof isRoleGroupedColors>[0])) {
        setRoleGroupedSlug(slug);
        return;
      }

      setRoleGroupedSlug(null);
      setBrand(full as api.BrandConfig & { colors: api.BrandColors });
      setMode("edit");
      setStatus("idle");
      setError("");

      try {
        const assetData = await api.getBrandAssets(slug);
        setLogoAssets(assetData.assets);
      } catch {
        setLogoAssets({});
      }

      setSheetOpen(true);
    } catch (err: any) {
      console.error("Failed to load brand:", err);
    }
  }

  function updateName(name: string) {
    setBrand((prev) => ({
      ...prev,
      name,
      slug: mode === "new" ? slugify(name) : prev.slug,
    }));
  }

  function updateColor(key: keyof api.BrandColors, value: string) {
    setBrand((prev) => ({
      ...prev,
      colors: { ...(prev.colors as unknown as api.BrandColors), [key]: value },
    }));
  }

  function updateFont(key: keyof api.BrandFonts, value: string) {
    setBrand((prev) => ({
      ...prev,
      fonts: { ...prev.fonts, [key]: value },
    }));
  }

  async function handleSave() {
    setStatus("saving");
    setError("");
    try {
      if (mode === "new") {
        await api.createBrand(brand);  // key read by the api helper
      } else {
        await api.updateBrand(brand.slug, brand);
      }
      setStatus("saved");
      await loadBrands();
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    try {
      await api.deleteBrand(brand.slug);
      setSheetOpen(false);
      await loadBrands();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Brands" }]} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Brands</h1>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          New Brand
        </Button>
      </div>

      {roleGroupedSlug && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Expanded schema</p>
              <p className="text-xs mt-1">
                Brand <code className="font-mono">{roleGroupedSlug}</code> uses the role-grouped color schema.
                The legacy flat editor cannot modify it without data loss. Edit via the full brand editor
                at <code className="font-mono">/brands/{roleGroupedSlug}</code> or the on-disk <code className="font-mono">brand.json</code>.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleGroupedSlug(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No brands yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {brands.map((b) => (
            <div key={b.slug} className="relative group">
              <BrandCard
                name={b.name}
                slug={b.slug}
                description={b.description}
                primaryColor={b.primaryColor}
                onClick={() => openEdit(b.slug)}
              />
              {/* SPEC-007 REQ-015 — "Edit full profile" link to the tabbed
                  editor at /brands/[slug]. Positioned as an overlay so the
                  existing sheet-based quick editor (openEdit) keeps its
                  click target on the card body. */}
              <Link
                href={`/brands/${b.slug}`}
                className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium shadow-sm opacity-0 transition-opacity hover:bg-accent focus:opacity-100 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Edit full profile for ${b.name}`}
              >
                <SlidersHorizontal className="h-3 w-3" />
                Full editor
              </Link>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-[480px] overflow-hidden p-0 sm:max-w-[480px]"
          style={{ backgroundColor: "#e0e4e8" }}
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>
              {mode === "new" ? "New Brand" : `Edit: ${brand.name}`}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="space-y-6 px-6 py-4">
              {/* Identity */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Identity
                </h3>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={brand.name}
                    onChange={(e) => updateName(e.target.value)}
                    placeholder="Brand name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Slug</label>
                  <Input
                    value={brand.slug}
                    onChange={(e) =>
                      setBrand((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    placeholder="brand-slug"
                    disabled={mode === "edit"}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Description
                  </label>
                  <Input
                    value={brand.description}
                    onChange={(e) =>
                      setBrand((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Short description"
                  />
                </div>
              </section>

              <Separator />

              {/* Logo Management */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Logos
                </h3>
                <div className="space-y-3">
                  {(["mark", "horizontal", "favicon"] as const).map((key) => (
                    <LogoUploadCard
                      key={key}
                      label={key === "mark" ? "Mark (Icon)" : key === "horizontal" ? "Horizontal (Full)" : "Favicon"}
                      currentUrl={logoAssets[key]}
                      onUpload={async (file) => {
                        const slug = brand.slug;
                        if (!slug) return;
                        const base64 = await fileToBase64(file);
                        const ext = file.name.split(".").pop() || "svg";
                        const filename = `${key}.${ext}`;
                        await api.uploadAsset(`brands/${slug}`, filename, base64);
                        // Update brand logo field
                        const newLogo = {
                          mark: "",
                          horizontal: "",
                          favicon: "",
                          ...(brand.logo ?? {}),
                          [key]: `${slug}/${filename}`,
                        };
                        setBrand({ ...brand, logo: newLogo });
                        // Refresh asset URLs
                        try {
                          const assetData = await api.getBrandAssets(slug);
                          setLogoAssets(assetData.assets);
                        } catch {}
                      }}
                      onRemove={() => {
                        const newLogo = {
                          mark: "",
                          horizontal: "",
                          favicon: "",
                          ...(brand.logo ?? {}),
                          [key]: "",
                        };
                        setBrand({ ...brand, logo: newLogo });
                        setLogoAssets({ ...logoAssets, [key]: "" });
                      }}
                    />
                  ))}
                </div>
              </section>

              <Separator />

              {/* Colors */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Colors
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    Object.keys(COLOR_LABELS) as (keyof api.BrandColors)[]
                  ).map((key) => (
                    <ColorPicker
                      key={key}
                      label={COLOR_LABELS[key]}
                      value={(brand.colors as unknown as api.BrandColors)[key] ?? ""}
                      onChange={(val) => updateColor(key, val)}
                    />
                  ))}
                </div>
              </section>

              <Separator />

              {/* Fonts */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Fonts
                </h3>
                <FontPicker
                  label="Heading"
                  value={brand.fonts.heading}
                  onChange={(v) => updateFont("heading", v)}
                  filter="sans"
                />
                <FontPicker
                  label="Body"
                  value={brand.fonts.body}
                  onChange={(v) => updateFont("body", v)}
                  filter="sans"
                />
                <FontPicker
                  label="Mono"
                  value={brand.fonts.mono}
                  onChange={(v) => updateFont("mono", v)}
                  filter="mono"
                />
              </section>

              <Separator />

              {/* Live Preview */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </h3>
                {(() => {
                  // Preview section is only reachable via the flat editor
                  // sheet, which is guarded from opening for role-grouped
                  // brands. Cast narrow here to keep the JSX readable.
                  const flat = brand.colors as unknown as api.BrandColors;
                  return (
                    <Card className="overflow-hidden border-0 shadow-md">
                      <div
                        style={{
                          backgroundColor: flat.primary,
                          color: flat.surface,
                          fontFamily: brand.fonts.heading,
                        }}
                        className="px-4 py-3 text-sm font-semibold"
                      >
                        {brand.name || "Brand Name"}
                      </div>
                      <div
                        style={{
                          backgroundColor: flat.background,
                          color: flat.text,
                          fontFamily: brand.fonts.body,
                        }}
                        className="space-y-3 p-4"
                      >
                        <h4 className="text-lg font-bold">Welcome</h4>
                        <p
                          className="text-sm"
                          style={{ color: flat.textMuted }}
                        >
                          This is a live preview of your brand&apos;s color system.
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="rounded px-3 py-1.5 text-xs font-medium text-white"
                            style={{ backgroundColor: flat.primary }}
                          >
                            Primary
                          </button>
                          <button
                            className="rounded px-3 py-1.5 text-xs font-medium text-white"
                            style={{ backgroundColor: flat.accent }}
                          >
                            Accent
                          </button>
                          <button
                            className="rounded border px-3 py-1.5 text-xs font-medium"
                            style={{
                              borderColor: flat.border,
                              color: flat.text,
                            }}
                          >
                            Outline
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </section>

              <Separator />

              {/* Actions */}
              <div className="flex items-center gap-3 pb-6">
                <Button
                  onClick={handleSave}
                  disabled={status === "saving" || !brand.name || !brand.slug}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {status === "saving" ? "Saving..." : "Save"}
                </Button>
                {mode === "edit" && (
                  <Button variant="destructive" onClick={handleDelete}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
                {status === "saved" && (
                  <Badge variant="secondary">Saved</Badge>
                )}
                {status === "error" && (
                  <Badge variant="destructive">{error}</Badge>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
