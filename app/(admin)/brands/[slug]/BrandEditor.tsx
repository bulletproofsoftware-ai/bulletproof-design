"use client";

import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/features/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Key, Save } from "lucide-react";
import * as api from "@/lib/api";
import { OverviewTab } from "./_tabs/OverviewTab";
import { ColorsTab } from "./_tabs/ColorsTab";
import { TypographyTab } from "./_tabs/TypographyTab";
import { LogosTab } from "./_tabs/LogosTab";
import { GuidelinesTab } from "./_tabs/GuidelinesTab";

const API_KEY_STORAGE = "design-api-key";

/**
 * Tab-level save status. `saving` and `error` show inline feedback in the
 * sticky header; `saved` auto-clears after 2s so the header doesn't stay
 * pinned to a stale green badge.
 */
export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; message: string };

/**
 * Tabbed brand admin editor (SPEC-007). Each tab is an isolated client
 * component that receives the current brand config, a mutator for the
 * parent state, and a shared save handler. The editor owns:
 *   - `brand` — the working copy of the brand config. Saves push this
 *               to `PUT /api/brands/:slug`.
 *   - `apiKey` — optional; required by logos + guidelines endpoints.
 *               Stored in localStorage because production deployments pin
 *               the key out-of-band (see SPEC-007 §UX Details).
 *   - `saveStatus` — shared transient save indicator.
 */
export function BrandEditor({
  initialBrand,
}: {
  initialBrand: api.BrandConfig;
}) {
  const [brand, setBrand] = useState<api.BrandConfig>(initialBrand);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyHydrated, setApiKeyHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });

  // Hydrate the API key from localStorage on mount. We deliberately do
  // this in useEffect (not during render) for hydration safety — the
  // server HTML never contains the key, so the initial client render
  // matches the SSR output.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(API_KEY_STORAGE);
      if (stored) setApiKey(stored);
    } catch {
      /* localStorage unavailable — fine, editor works without it for read-only flows */
    }
    setApiKeyHydrated(true);
  }, []);

  // Persist API key changes so the next session doesn't re-prompt.
  useEffect(() => {
    if (!apiKeyHydrated) return;
    try {
      if (apiKey) {
        window.localStorage.setItem(API_KEY_STORAGE, apiKey);
      } else {
        window.localStorage.removeItem(API_KEY_STORAGE);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [apiKey, apiKeyHydrated]);

  // Auto-clear `saved` banner after 2s. Errors stay until the next save.
  useEffect(() => {
    if (saveStatus.state !== "saved") return;
    const t = setTimeout(() => setSaveStatus({ state: "idle" }), 2000);
    return () => clearTimeout(t);
  }, [saveStatus]);

  /**
   * Shared save handler — used by Overview, Colors, Typography. Writes
   * the current `brand` to `PUT /api/brands/:slug`. Logos/Guidelines have
   * their own save paths (they hit dedicated endpoints and need the API
   * key), so they do NOT go through this function.
   */
  const saveBrand = useCallback(async () => {
    setSaveStatus({ state: "saving" });
    try {
      await api.updateBrand(brand.slug, brand, apiKey);
      setSaveStatus({ state: "saved" });
    } catch (err) {
      setSaveStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [brand]);

  /**
   * Re-fetch the brand from the server. Used after the Logos tab uploads
   * or removes a logo — the server mutates `brand.json`, and the editor's
   * working copy needs to pick up the new `logos` manifest.
   */
  const reloadBrand = useCallback(async () => {
    try {
      const fresh = await api.getBrand(brand.slug);
      setBrand(fresh);
    } catch (err) {
      setSaveStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [brand.slug]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Brands", href: "/brands" },
          { label: brand.name || brand.slug },
        ]}
      />

      {/* Sticky page header with name + API key + save status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{brand.name || brand.slug}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            /brands/{brand.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
              className="h-8 w-44 text-xs"
              aria-label="API key"
            />
          </div>
          <Button
            onClick={saveBrand}
            disabled={saveStatus.state === "saving"}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="mr-1 h-4 w-4" />
            {saveStatus.state === "saving" ? "Saving..." : "Save"}
          </Button>
          {saveStatus.state === "saved" && (
            <Badge variant="secondary">Saved</Badge>
          )}
          {saveStatus.state === "error" && (
            <Badge variant="destructive" title={saveStatus.message}>
              {saveStatus.message.length > 40
                ? `${saveStatus.message.slice(0, 40)}…`
                : saveStatus.message}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab brand={brand} onChange={setBrand} />
        </TabsContent>

        <TabsContent value="colors">
          <ColorsTab brand={brand} onChange={setBrand} />
        </TabsContent>

        <TabsContent value="typography">
          <TypographyTab brand={brand} onChange={setBrand} />
        </TabsContent>

        <TabsContent value="logos">
          <LogosTab brand={brand} apiKey={apiKey} onReload={reloadBrand} />
        </TabsContent>

        <TabsContent value="guidelines">
          <GuidelinesTab slug={brand.slug} apiKey={apiKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
