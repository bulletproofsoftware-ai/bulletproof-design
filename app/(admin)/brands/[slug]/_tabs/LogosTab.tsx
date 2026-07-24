"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import type { LogoEntry } from "@/lib/types/brand";

const LOGO_KEYS: api.LogoKey[] = ["horizontal", "vertical", "icon"];

const LABELS: Record<api.LogoKey, string> = {
  horizontal: "Horizontal",
  vertical: "Vertical",
  icon: "Icon",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8096";

/**
 * Build the URL to a brand's logo asset. Mirrors the server-side
 * `assetUrl(slug, file)` helper used by GET /api/brands/:slug/logos —
 * the backend serves logos at `/brand-assets/:slug/:file` via the
 * `brandAssetsStaticRouter` mounted in src/api/server.ts (outside the
 * `/api` prefix so CORS/auth gates do not apply).
 */
function logoAssetUrl(slug: string, file: string): string {
  return `${API_BASE}/brand-assets/${encodeURIComponent(
    slug,
  )}/${encodeURIComponent(file)}`;
}

/**
 * Logos tab — three slots (horizontal/vertical/icon) wired to the
 * SPEC-004 POST/DELETE endpoints. Each slot has its own upload form
 * (label + usage + preferred + file input) and can also be deleted in
 * place. Uploads and deletes round-trip through the server, so on success
 * we call `onReload()` to refetch the brand and pick up the updated
 * `logos` manifest.
 *
 * Flat brands (non-directory) cannot own managed logos — the server
 * returns 409 and we surface that inline so the user sees the migration
 * hint rather than a silent failure.
 */
export function LogosTab({
  brand,
  apiKey,
  onReload,
}: {
  brand: api.BrandConfig;
  apiKey: string;
  onReload: () => Promise<void>;
}) {
  const logos = brand.logos ?? {};

  return (
    <div className="space-y-6">
      {!apiKey && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">API key required</p>
          <p className="mt-1">
            Logo uploads and deletions require a valid API key (set it in the
            header above).
          </p>
        </div>
      )}
      {LOGO_KEYS.map((key) => (
        <LogoSlot
          key={key}
          slug={brand.slug}
          logoKey={key}
          entry={logos[key]}
          apiKey={apiKey}
          onReload={onReload}
        />
      ))}
    </div>
  );
}

function LogoSlot({
  slug,
  logoKey,
  entry,
  apiKey,
  onReload,
}: {
  slug: string;
  logoKey: api.LogoKey;
  entry: LogoEntry | undefined;
  apiKey: string;
  onReload: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(entry?.label ?? LABELS[logoKey]);
  const [usage, setUsage] = useState(entry?.usage ?? "");
  const [preferred, setPreferred] = useState(entry?.preferred ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation mirrors the server limits so users get
    // immediate feedback without waiting for a 400.
    const validation = api.validateLogoFile(file);
    if (!validation.ok) {
      setError(validation.error ?? "Invalid file");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (!label.trim() || !usage.trim()) {
      setError("Label and usage are required before uploading.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api.uploadLogo(
        slug,
        file,
        { key: logoKey, label: label.trim(), usage: usage.trim(), preferred },
        apiKey,
      );
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!entry) return;
    if (!confirm(`Remove the ${LABELS[logoKey].toLowerCase()} logo?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteLogo(slug, logoKey, apiKey);
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = entry ? logoAssetUrl(slug, entry.file) : undefined;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{LABELS[logoKey]}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry?.file ? (
              <code className="font-mono">{entry.file}</code>
            ) : (
              "No logo uploaded"
            )}
          </p>
        </div>
        {entry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={busy || !apiKey}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        {/* Preview */}
        <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/30 p-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={entry?.label ?? LABELS[logoKey]}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Upload
              className="h-8 w-8 text-muted-foreground/50"
              aria-hidden
            />
          )}
        </div>

        {/* Meta + actions */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Short human-readable label"
              className="h-8"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Usage
            </label>
            <Input
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              placeholder="Guidance for when to use this logo"
              className="h-8"
              maxLength={500}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={preferred}
              onChange={(e) => setPreferred(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Preferred variant</span>
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy || !apiKey}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" />
                  {entry ? "Replace" : "Upload"}
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              SVG, PNG, or JPEG. Max{" "}
              {api.LOGO_UPLOAD_MAX_BYTES / 1024 / 1024} MB.
            </p>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>
    </Card>
  );
}
